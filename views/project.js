var identityLine = require('./partials/identity-line')
var renderActivity = require('./partials/activity')
var renderDraftHeader = require('./partials/draft-header')
var renderDraftIcon = require('./partials/draft-icon')
var renderDraftLink = require('./partials/draft-link')
var renderIntro = require('./partials/intro')
var renderLoading = require('./loading')
var renderMarkIcon = require('./partials/mark-icon')
var renderRefreshNotice = require('./partials/refresh-notice')

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
      main.appendChild(renderWhatsNew(state))
      if (state.draftBriefs.length !== 0) {
        main.appendChild(renderGraph(state, send))
      }
      main.appendChild(newDraft(state))
      if (state.draftSelection.size > 0) {
        main.appendChild(renderDeselect(send))
      }
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

function renderDeselect (send) {
  var button = document.createElement('button')
  button.className = 'deselect'
  button.addEventListener('click', function () {
    send('deselect all drafts')
  })
  button.appendChild(document.createTextNode('Deselect all drafts.'))
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

// TODO: Graph merging drafts.
// TODO: Render lines between graph nodes

function renderGraph (state, send) {
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

  var selectedMultiple = state.draftSelection.size > 1

  briefs.forEach(function (brief) {
    var selected = state.draftSelection.has(brief.digest)

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
    if (selected) td.className += ' selected'

    if (!selectedMultiple || selected) {
      var checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.className = 'draftCheckBox'
      checkbox.addEventListener('change', function (event) {
        if (event.target.checked) send('select draft', brief.digest)
        else send('deselect draft', brief.digest)
      })
      if (selected) checkbox.checked = true
      td.appendChild(checkbox)
    }

    td.appendChild(renderDraftIcon())
    td.appendChild(document.createTextNode(' '))
    td.appendChild(renderDraftLink(state, brief))

    var marks = digestToMarks[brief.digest]
    if (marks) {
      marks.forEach(function (mark) {
        var p = document.createElement('p')
        td.appendChild(p)
        p.className = 'mark'
        p.appendChild(renderMarkIcon())
        p.appendChild(document.createTextNode(' '))
        p.appendChild(document.createTextNode(mark.message.body.name))
        p.appendChild(document.createTextNode(' ('))
        p.appendChild(renderIntro(state, mark.publicKey))
        p.appendChild(document.createTextNode(')'))
      })
    }
    if (brief.notesCount) {
      var p = document.createElement('p')
      td.appendChild(p)
      p.className = 'notesCount'
      p.appendChild(document.createTextNode(brief.notesCount))
      p.appendChild(document.createTextNode(
        brief.notesCount === 1 ? ' note' : ' notes'
      ))
    }

    var a = document.createElement('a')
    a.className = 'button'
    if (selectedMultiple && selected) {
      a.className = 'button'
      a.href = (
        '/projects/' + state.discoveryKey +
        '/drafts/new/' + Array.from(state.draftSelection).join(',')
      )
      a.appendChild(document.createTextNode('Combine the drafts you selected.'))
    } else {
      a.href = (
        '/projects/' + state.discoveryKey +
        '/drafts/new/' + brief.digest
      )
      a.appendChild(document.createTextNode('Start a new draft based on this one.'))
    }
    td.appendChild(a)
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

function renderWhatsNew (state) {
  var section = document.createElement('section')

  var h2 = document.createElement('h2')
  section.appendChild(h2)
  h2.appendChild(document.createTextNode('What’s New'))

  section.appendChild(renderActivity(state, state.activity))
  return section
}
