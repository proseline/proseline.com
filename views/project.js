var identityLine = require('./partials/identity-line')
var loading = require('./loading')
var renderRefreshNotice = require('./partials/refresh-notice')
var timestamp = require('./partials/timestamp')

module.exports = function (state, send, discoveryKey) {
  var main = document.createElement('main')
  if (discoveryKey && state.discoveryKey !== discoveryKey) {
    main.appendChild(
      loading(function () {
        send('load project', discoveryKey)
      })
    )
  } else {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('load project', discoveryKey)
      }))
    }
    var h1 = document.createElement('h1')
    h1.appendChild(document.createTextNode(state.title))
    main.appendChild(h1)
    main.appendChild(renameSection(send))
    main.appendChild(deleteSection(state, send))
    main.appendChild(identityLine(state, send))
    main.appendChild(graph(state))
    main.appendChild(newDraftSection(state))
    main.appendChild(shareSection(state))
  }
  return main
}

function renameSection (send) {
  var section = document.createElement('section')

  var form = document.createElement('form')
  section.appendChild(form)
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('rename', input.value)
  })

  var input = document.createElement('input')
  input.type = 'text'
  input.required = true
  form.appendChild(input)

  var button = document.createElement('button')
  button.type = 'submit'
  button.appendChild(document.createTextNode('Rename'))
  form.appendChild(button)

  return section
}

var CONFIRM_DELETE = 'Do you really want to delete this project?'

function deleteSection (state, send) {
  var section = document.createElement('section')
  var button = document.createElement('button')
  button.appendChild(document.createTextNode('Delete Project'))
  button.addEventListener('click', function () {
    if (window.confirm(CONFIRM_DELETE)) {
      send('delete project', state.discoveryKey)
    }
  })
  section.appendChild(button)
  return section
}

function newDraftSection (state) {
  var section = document.createElement('section')

  var a = document.createElement('a')
  a.href = '/projects/' + state.discoveryKey + '/drafts/new'
  a.appendChild(document.createTextNode('New Draft'))
  section.appendChild(a)

  return section
}

function shareSection (state) {
  var section = document.createElement('section')

  var h2 = document.createElement('h2')
  h2.appendChild(document.createTextNode('Share'))
  section.appendChild(h2)

  var a = document.createElement('a')
  var url = 'https://proseline.com/join/' + state.secretKey
  a.appendChild(document.createTextNode(url))
  a.setAttribute('href', url)
  section.appendChild(a)

  return section
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
