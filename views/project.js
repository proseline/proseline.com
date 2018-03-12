var dagre = require('dagre')
var identityLine = require('./partials/identity-line')
var moment = require('moment')
var renderActivity = require('./partials/activity')
var renderDraftHeader = require('./partials/draft-header')
var renderRefreshNotice = require('./partials/refresh-notice')
var renderSection = require('./partials/section')
var withProject = require('./with-project')

module.exports = withProject(function (state, send, discoveryKey) {
  state.route = 'project'
  var main = document.createElement('main')
  if (state.changed) {
    main.appendChild(renderRefreshNotice(function () {
      send('load project', discoveryKey)
    }))
  }
  main.appendChild(renderDraftHeader(state))
  var intro = state.intros[state.identity.publicKey]
  if (!intro) {
    var introSection = renderSection('Introduce Yourself')
    main.appendChild(introSection)
    introSection.appendChild(identityLine(send))
  } else {
    main.appendChild(renderWhatsNew(state))
    if (state.draftBriefs.length !== 0) {
      var graphSection = renderSection('Project Map')
      main.appendChild(graphSection)
      graphSection.appendChild(renderGraph(state, send))
    }
    var newSection = renderSection('Start from Scratch')
    main.appendChild(newSection)
    newSection.appendChild(newDraft(state))
    if (state.draftSelection.size > 0) {
      main.appendChild(renderDeselect(send))
    }
    main.appendChild(renderShareSection(state))
    main.appendChild(renderOrganizeSection(state, send))
    main.appendChild(renderRenameSection(state, send))
  }
  return main
})

function renderDeleteExplanation () {
  var p = document.createElement('p')
  p.appendChild(document.createTextNode(
    'Leaving this project deletes it from your computer. ' +
    'To see the project again, you will need an invitation link. ' +
    'Leaving the project does not delete your work from other ' +
    'member’s computers.'
  ))
  return p
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
  var section = document.createElement('section')

  var a = document.createElement('a')
  section.appendChild(a)
  a.className = 'button'
  a.href = '/projects/' + state.discoveryKey + '/drafts/new'
  a.appendChild(document.createTextNode('Start a new draft from scratch.'))

  return section
}

function inviteExplanation () {
  var p = document.createElement('p')
  p.appendChild(document.createTextNode(
    'To invite others to join your project, ' +
    'send them a link with a secret code. ' +
    'Everyone with the secret code can create drafts, ' +
    'add comments, create and move marks, ' +
    'and see all the work done by others on the project.'
  ))
  return p
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
    'E-mail a link for joining this project.'
  ))
  return a
}

function copyInvitation (state) {
  var a = document.createElement('a')
  a.className = 'clipboard button'
  var url = 'https://proseline.com/join/' + state.secretKey
  a.setAttribute('data-clipboard-text', url)
  a.appendChild(document.createTextNode('Copy a link for joining this project.'))
  return a
}

var SVG = 'http://www.w3.org/2000/svg'

var BRIEF_WIDTH = 85 * 1.5
var BRIEF_HEIGHT = 110 * 1.5
var BOOKMARK_WIDTH = 20

function renderGraph (state, send) {
  var briefs = withoutOrphans(state.draftBriefs)
  var graph = new dagre.graphlib.Graph({directed: true})
  graph.setGraph({})
  graph.setDefaultEdgeLabel(function () { return {} })
  briefs.forEach(function (brief) {
    graph.setNode(brief.digest, {
      brief,
      width: BRIEF_WIDTH,
      height: BRIEF_HEIGHT
    })
    brief.parents.forEach(function (parent) {
      graph.setEdge(brief.digest, parent)
    })
  })
  dagre.layout(graph, {
    rankdir: 'TB',
    align: 'TB',
    nodesep: 50,
    edgesep: 10
  })

  var MARGIN = 20

  // <svg>
  var svg = document.createElementNS(SVG, 'svg')
  var boxWidth = graph.graph().width + (2 * MARGIN)
  var boxHeight = graph.graph().height + (2 * MARGIN)
  svg.setAttributeNS(null, 'viewBox', '0 0 ' + boxWidth + ' ' + boxHeight)
  svg.setAttributeNS(null, 'height', boxHeight)
  svg.setAttributeNS(null, 'width', boxWidth)
  svg.setAttribute('class', 'graph')

  // <title>
  var title = document.createElementNS(SVG, 'title')
  svg.appendChild(title)
  title.appendChild(document.createTextNode('Graph of Drafts'))

  // Render nodes.
  graph.nodes().forEach(function (name) {
    var node = graph.node(name)
    var x = node.x + MARGIN - (node.width / 2)
    var y = node.y + MARGIN - (node.height / 2)
    var brief = node.brief

    var g = document.createElementNS(SVG, 'g')
    svg.appendChild(g)

    var a = document.createElementNS(SVG, 'a')
    g.appendChild(a)
    a.setAttributeNS(null, 'href', (
      '/projects/' + state.discoveryKey +
      '/drafts/' + brief.digest
    ))

    var rect = document.createElementNS(SVG, 'rect')
    a.appendChild(rect)
    rect.setAttributeNS(null, 'class', 'draft')
    rect.setAttributeNS(null, 'x', x)
    rect.setAttributeNS(null, 'y', y)
    rect.setAttributeNS(null, 'width', node.width)
    rect.setAttributeNS(null, 'height', node.height)
    rect.setAttributeNS(null, 'fill', 'white')
    rect.setAttributeNS(null, 'stroke', 'black')
    rect.setAttributeNS(null, 'stroke-width', 2)

    var author = document.createElementNS(SVG, 'text')
    a.appendChild(author)
    author.setAttributeNS(null, 'x', node.x + MARGIN)
    author.setAttributeNS(null, 'y', node.y - 2 * (node.height / 6) + MARGIN)
    author.setAttributeNS(null, 'text-anchor', 'middle')
    author.setAttributeNS(null, 'font-size', '100%')
    author.appendChild(document.createTextNode(
      plainTextIntro(state, brief.publicKey)
    ))

    var timestamp = document.createElementNS(SVG, 'text')
    a.appendChild(timestamp)
    timestamp.setAttributeNS(null, 'class', 'relativeTimestamp')
    timestamp.setAttributeNS(null, 'x', node.x + MARGIN)
    timestamp.setAttributeNS(null, 'y', node.y - (node.height / 6) + MARGIN)
    timestamp.setAttributeNS(null, 'text-anchor', 'middle')
    timestamp.setAttributeNS(null, 'font-size', '75%')
    timestamp.appendChild(document.createTextNode(
      moment(brief.timestamp).fromNow()
    ))

    if (brief.notesCount && brief.notesCount !== 0) {
      var notesWidth = 36
      var notesX = node.x + MARGIN + (node.width / 2) - (notesWidth / 2)
      var notesY = node.y + MARGIN + (node.height / 2) - (notesWidth / 2)

      var notesRect = document.createElementNS(SVG, 'rect')
      a.appendChild(notesRect)
      notesRect.setAttributeNS(null, 'x', notesX)
      notesRect.setAttributeNS(null, 'y', notesY)
      notesRect.setAttributeNS(null, 'width', notesWidth)
      notesRect.setAttributeNS(null, 'height', notesWidth)
      notesRect.setAttributeNS(null, 'stroke', 'black')
      notesRect.setAttributeNS(null, 'stroke-width', 1)
      notesRect.setAttributeNS(null, 'fill', 'yellow')

      var notesCountFontSize = 14

      var notesCount = document.createElementNS(SVG, 'text')
      a.appendChild(notesCount)
      notesCount.setAttributeNS(null, 'x', notesX + (notesWidth / 2))
      notesCount.setAttributeNS(null, 'y', notesY + (notesWidth / 2) + (notesCountFontSize / 2))
      notesCount.setAttributeNS(null, 'text-anchor', 'middle')
      notesCount.setAttributeNS(null, 'font-size', notesCountFontSize)
      notesCount.appendChild(document.createTextNode(brief.notesCount))
    }

    var marks = state.projectMarks
      .sort(byTimestamp)
      .filter(function (mark) {
        return mark.message.body.draft === brief.digest
      })
    var othersMarks = []
    var ourMarks = []
    marks.forEach(function (mark) {
      (mark.publicKey === state.identity.publicKey ? ourMarks : othersMarks)
        .push(mark)
    })

    if (marks.length !== 0) {
      var marksCount = document.createElementNS(SVG, 'text')
      a.appendChild(marksCount)
      marksCount.setAttributeNS(null, 'x', node.x + MARGIN)
      marksCount.setAttributeNS(null, 'y', node.y + 2 * (node.height / 6) + MARGIN)
      marksCount.setAttributeNS(null, 'text-anchor', 'middle')
      marksCount.setAttributeNS(null, 'font-size', '80%')
      if (ourMarks.length !== 0) {
        marksCount.setAttributeNS(null, 'font-weight', 'bold')
      }
      var text = (ourMarks.length !== 0)
        ? (
          ourMarks[0].message.body.name +
          (marks.length > 1 ? '...' : '')
        )
        : (
          marks.length + ' ' +
          (marks.length === 1 ? 'mark' : 'marks')
        )
      marksCount.appendChild(document.createTextNode(text))
    }

    if (othersMarks.length !== 0) {
      svg.appendChild(
        renderBookmark(
          node.x + MARGIN + (node.width / 2) - BOOKMARK_WIDTH - 10,
          node.y + MARGIN - (node.height / 2),
          'blue'
        )
      )
    }

    if (ourMarks.length !== 0) {
      svg.appendChild(
        renderBookmark(
          node.x + MARGIN + (node.width / 2) - BOOKMARK_WIDTH - 5,
          node.y + MARGIN - (node.height / 2),
          'red'
        )
      )
    }
  })

  // Render edges.
  graph.edges().forEach(function (nodes) {
    var edge = graph.edge(nodes)
    var polyline = document.createElementNS(SVG, 'polyline')
    svg.appendChild(polyline)
    var points = edge.points
      .map(function (point) {
        return (point.x + MARGIN) + ' ' + (point.y + MARGIN)
      })
      .join(', ')
    polyline.setAttributeNS(null, 'points', points)
    polyline.setAttributeNS(null, 'fill', 'none')
    polyline.setAttributeNS(null, 'stroke', 'black')
    polyline.setAttributeNS(null, 'stroke-width', 1)
    polyline.setAttributeNS(null, 'stroke-dasharray', '5,5')
  })

  return svg
}

function renderBookmark (x, y, color) {
  var bookmarkHeight = 40
  var bookmarkNotch = 10
  var bookmark = document.createElementNS(SVG, 'path')
  var commands = [
    ['M', x, y],
    ['l', BOOKMARK_WIDTH, 0],
    ['l', 0, bookmarkHeight],
    ['l', -(BOOKMARK_WIDTH / 2), -bookmarkNotch],
    ['l', -(BOOKMARK_WIDTH / 2), +bookmarkNotch],
    ['z']
  ]
    .map(function (element) {
      return element[0] + element.slice(1).join(' ')
    })
    .join(' ')
  bookmark.setAttributeNS(null, 'd', commands)
  bookmark.setAttributeNS(null, 'fill', color)
  bookmark.setAttributeNS(null, 'stroke', 'black')
  bookmark.setAttributeNS(null, 'stroke-width', 1)
  return bookmark
}

function plainTextIntro (state, publicKey) {
  if (publicKey === state.identity.publicKey) return 'You'
  var intro = state.intros[publicKey]
  if (intro) {
    return intro.message.body.name
  } else {
    return 'anonymous'
  }
}

function withoutOrphans (briefs) {
  var digestsSeen = new Set()
  return briefs
    .sort(byTimestamp)
    .filter(function removeOrphans (brief) {
      digestsSeen.add(brief.digest)
      return (
        brief.parents.length === 0 ||
        brief.parents.some(function (parent) {
          return digestsSeen.has(parent)
        })
      )
    })
}

function renderShareSection (state) {
  var section = renderSection('Share')
  section.appendChild(inviteExplanation())
  section.appendChild(inviteViaEMail(state))
  section.appendChild(copyInvitation(state))
  return section
}

function renderOrganizeSection (state, send) {
  var section = renderSection('Organize')
  section.appendChild(renderDeleteExplanation())
  section.appendChild(renderDeleteButton(state, send))
  return section
}

function renderRenameSection (state, send) {
  var section = renderSection('Rename')
  section.appendChild(renderRenameExplanation())
  section.appendChild(renderRename(state, send))
  return section
}

function renderRenameExplanation () {
  var p = document.createElement('p')
  p.appendChild(document.createTextNode(
    'Renaming the project changes your name for the project. ' +
    'Other members of the project cannot see the name you use.'
  ))
  return p
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
  var section = renderSection('What’s New')
  section.appendChild(renderActivity(state, state.activity))
  return section
}

function byTimestamp (a, b) {
  return new Date(a.timestamp) - new Date(b.timestamp)
}
