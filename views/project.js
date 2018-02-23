var identityLine = require('./partials/identity-line')
var renderDraftHeader = require('./partials/draft-header')
var renderDraftLink = require('./partials/draft-link')
var renderIntro = require('./partials/intro')
var renderLoading = require('./loading')
var renderRefreshNotice = require('./partials/refresh-notice')
var renderRelativeTimestamp = require('./partials/relative-timestamp')

module.exports = function (state, send, discoveryKey) {
  var main = document.createElement('main')
  if (discoveryKey && state.discoveryKey !== discoveryKey) {
    main.appendChild(
      renderLoading(function () {
        send('load project', discoveryKey)
      }, 'Loading project…')
    )
  } else {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('load project', discoveryKey)
      }))
    }
    main.appendChild(renderDraftHeader(state))
    var intro = state.intros[state.identity.publicKey]
    if (!intro) {
      main.appendChild(identityLine(send))
    } else {
      main.appendChild(activity(state, send))
      if (state.draftBriefs.length !== 0) {
        main.appendChild(graph(state))
      }
      main.appendChild(newDraft(state))
      main.appendChild(share(state))
      main.appendChild(organize(state, send))
    }
  }
  return main
}

var CONFIRM_DELETE = 'Do you really want to delete this project?'

function renderDeleteButton (state, send) {
  var button = document.createElement('button')
  button.id = 'deleteProject'
  button.appendChild(document.createTextNode('Leave this project.'))
  button.addEventListener('click', function () {
    if (window.confirm(CONFIRM_DELETE)) {
      send('delete project', state.discoveryKey)
    }
  })
  return button
}

function newDraft (state) {
  var a = document.createElement('a')
  a.className = 'button'
  a.href = '/projects/' + state.discoveryKey + '/drafts/new'
  a.appendChild(document.createTextNode('Start a new draft from scratch.'))
  return a
}

function inviteViaEMail (state) {
  var a = document.createElement('a')
  a.className = 'button'
  var url = 'https://proseline.com/join/' + state.secretKey
  a.href = (
    'mailto:' +
    '?subject=' + encodeURIComponent('Proseline Project') +
    '&body=' + encodeURIComponent(url)
  )
  a.appendChild(document.createTextNode(
    'Invite someone to this project via e-mail.'
  ))
  return a
}

function copyInvitation (state) {
  var a = document.createElement('a')
  a.className = 'clipboard button'
  var url = 'https://proseline.com/join/' + state.secretKey
  a.setAttribute('data-clipboard-text', url)
  a.appendChild(document.createTextNode('Copy a link to this project.'))
  return a
}

function activity (state, send) {
  var section = document.createElement('section')

  var h2 = document.createElement('h2')
  section.appendChild(h2)
  h2.appendChild(document.createTextNode('What’s New'))

  var ol = document.createElement('ol')
  section.appendChild(ol)
  ol.className = 'activity'
  state.activity.forEach(function (envelope) {
    var body = envelope.message.body
    var type = body.type
    var li = document.createElement('li')
    var a
    ol.appendChild(li)
    if (type === 'draft') {
      li.appendChild(renderIntro(state, envelope.publicKey))
      li.appendChild(document.createTextNode(' added '))
      a = document.createElement('a')
      li.appendChild(a)
      a.href = (
        '/projects/' + envelope.message.project +
        '/drafts/' + envelope.digest
      )
      a.appendChild(document.createTextNode('a draft'))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(envelope.message.body.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'intro') {
      li.appendChild(renderIntro(state, envelope.publicKey))
      li.appendChild(document.createTextNode(
        ' introduced ' +
        (
          envelope.publicKey === state.identity.publicKey
            ? 'yourself '
            : 'themself '
        )
      ))
      li.appendChild(renderRelativeTimestamp(envelope.message.body.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'mark') {
      li.appendChild(renderIntro(state, envelope.publicKey))
      li.appendChild(document.createTextNode(' put the mark '))
      li.appendChild(document.createTextNode('“' + body.name + '”'))
      li.appendChild(document.createTextNode(' on '))
      li.appendChild(draftLink(state.discoveryKey, body.draft))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(envelope.message.body.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'note') {
      li.appendChild(renderIntro(state, envelope.publicKey))
      li.appendChild(document.createTextNode(' '))
      a = document.createElement('a')
      li.appendChild(a)
      a.href = (
        '/projects/' + envelope.message.project +
        '/drafts/' + envelope.message.body.draft +
        '#' + envelope.digest
      )
      a.appendChild(
        document.createTextNode(
          body.parent
            ? 'replied to a note'
            : 'added a note'
        )
      )
      li.appendChild(document.createTextNode(' to '))
      li.appendChild(draftLink(state.discoveryKey, body.draft))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(body.timestamp))
      li.appendChild(document.createTextNode('.'))
    }
  })

  return section
}

function draftLink (discoveryKey, digest) {
  var a = document.createElement('a')
  a.href = (
    '/projects/' + discoveryKey +
    '/drafts/' + digest
  )
  a.appendChild(document.createTextNode('this draft'))
  return a
}

// TODO: Graph merging drafts.
// TODO: Render lines between graph nodes

function graph (state) {
  var section = document.createElement('section')

  var h2 = document.createElement('h2')
  section.appendChild(h2)
  h2.appendChild(document.createTextNode('Project Map'))

  var digestsSeen = []
  var briefs = state.draftBriefs
    .sort(function (a, b) {
      return new Date(a.timestamp) - new Date(b.timestamp)
    })
    .filter(function removeOrphans (brief) {
      digestsSeen.push(brief.digest)
      return (
        brief.parents.length === 0 ||
        brief.parents.some(function (parent) {
          return digestsSeen.indexOf(parent) !== -1
        })
      )
    })
  digestsSeen = null

  briefs.reverse()

  var columnCounter = 0
  var columns = {}
  briefs.forEach(function (brief) {
    var digest = brief.digest
    if (columns.hasOwnProperty(digest)) {
      brief.column = columns[digest]
    } else {
      brief.column = columnCounter
      columnCounter++
    }
    if (brief.parents.length !== 0) {
      var firstParent = brief.parents[0]
      columns[firstParent] = brief.column
    }
  })

  var digestToMarks = {}
  state.projectMarks.forEach(function (mark) {
    var body = mark.message.body
    var digest = body.draft
    if (digestToMarks.hasOwnProperty(digest)) {
      digestToMarks[digest].push(mark)
    } else {
      digestToMarks[digest] = [mark]
    }
  })

  var table = document.createElement('table')
  section.appendChild(table)
  table.className = 'graph'

  briefs.forEach(function (brief) {
    var tr = document.createElement('tr')
    table.appendChild(tr)

    // <td>s for spacing
    for (var i = 0; i < brief.column; i++) {
      tr.appendChild(document.createElement('td'))
    }

    // Data <td>
    var td = document.createElement('td')
    tr.appendChild(td)
    td.className = 'draftCell'

    td.appendChild(renderDraftLink(state, brief))

    var marks = digestToMarks[brief.digest]
    if (marks) {
      marks.forEach(function (mark) {
        var p = document.createElement('p')
        td.appendChild(p)
        p.className = 'mark'
        p.appendChild(renderIntro(state, mark.publicKey))
        p.appendChild(document.createTextNode(': '))
        p.appendChild(document.createTextNode(mark.message.body.name))
      })
    }
  })

  return section
}

function share (state) {
  var section = document.createElement('section')

  var h2 = document.createElement('h2')
  section.appendChild(h2)
  h2.appendChild(document.createTextNode('Share'))

  section.appendChild(inviteViaEMail(state))
  section.appendChild(copyInvitation(state))

  return section
}

function organize (state, send) {
  var section = document.createElement('section')

  var h2 = document.createElement('h2')
  section.appendChild(h2)
  h2.appendChild(document.createTextNode('Organize'))

  section.appendChild(renderDeleteButton(state, send))
  section.appendChild(renderRename(state, send))

  return section
}

function renderRename (state, send) {
  var form = document.createElement('form')
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('rename', input.value)
  })

  var input = document.createElement('input')
  form.appendChild(input)
  input.requred = true
  input.value = state.title

  var button = document.createElement('button')
  form.appendChild(button)
  button.type = 'submit'
  button.appendChild(document.createTextNode('Rename this project.'))

  return form
}
