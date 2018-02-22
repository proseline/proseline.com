var identityLine = require('./partials/identity-line')
var loading = require('./loading')
var renderHomeLink = require('./partials/home-link')
var renderRefreshNotice = require('./partials/refresh-notice')
var timestamp = require('./partials/timestamp')

module.exports = function (state, send, discoveryKey) {
  var main = document.createElement('main')
  if (discoveryKey && state.discoveryKey !== discoveryKey) {
    main.appendChild(
      loading(function () {
        send('load project', discoveryKey)
      }, 'Loading project…')
    )
  } else {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('load project', discoveryKey)
      }))
    }
    main.appendChild(header(state, send))
    var intro = state.intros[state.identity.publicKey]
    if (!intro) {
      main.appendChild(identityLine(send))
    }
    main.appendChild(newDraft(state))
    main.appendChild(inviteViaEMail(state))
    main.appendChild(copyInvitation(state))
    if (state.draftBriefs.length !== 0) {
      main.appendChild(graph(state))
    }
  }
  return main
}

function header (state, send) {
  var header = document.createElement('header')

  header.appendChild(renderHomeLink())

  var title = document.createElement('a')
  title.appendChild(document.createTextNode(state.title))
  header.appendChild(title)

  header.appendChild(renameButton(state, send))
  header.appendChild(deleteButton(state, send))

  return header
}

var RENAME = 'Enter a new project title:'

function renameButton (state, send) {
  var button = document.createElement('button')
  button.id = 'renameProject'
  button.addEventListener('click', function (event) {
    var newTitle = window.prompt(RENAME, state.title)
    if (newTitle === null) return
    if (newTitle.length === 0) return
    send('rename', newTitle)
  })
  button.appendChild(document.createTextNode('Rename this project.'))
  return button
}

var CONFIRM_DELETE = 'Do you really want to delete this project?'

function deleteButton (state, send) {
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
  a.appendChild(document.createTextNode('Copy an invitation link.'))
  return a
}

// TODO: Graph merging drafts.
// TODO: Render lines between graph nodes

function graph (state) {
  var section = document.createElement('section')

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
    td.className = 'draft'

    var marks = digestToMarks[brief.digest]
    if (marks) {
      marks.forEach(function (mark) {
        var p = document.createElement('p')
        td.appendChild(p)
        p.className = 'mark'
        p.appendChild(document.createTextNode(mark.message.body.name))
      })
    }

    var a = document.createElement('a')
    a.href = (
      '/projects/' + state.discoveryKey +
      '/drafts/' + brief.digest
    )
    a.appendChild(document.createTextNode(truncate(brief.digest)))
    td.appendChild(a)

    td.appendChild(document.createElement('br'))

    td.appendChild(timestamp(brief.timestamp))

    brief.parents.forEach(function (parent) {
      td.appendChild(document.createElement('br'))
      td.appendChild(document.createTextNode(truncate(parent)))
    })
  })

  return section
}

function truncate (digest) {
  return digest.slice(0, 4) + '…'
}
