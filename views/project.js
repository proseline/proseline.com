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
  var a = document.createElement('a')
  a.className = 'button'
  a.href = '/projects/' + state.discoveryKey + '/drafts/new'
  a.appendChild(document.createTextNode('Start a new draft from scratch.'))
  return a
}

function inviteExplanation () {
  var p = document.createElement('p')
  p.appendChild(document.createTextNode(
    'To invite others to join your project, ' +
    'send them a link with a secret code. ' +
    'Everyone with the secret code can create drafts, ' +
    'add comments, create and move markers, ' +
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

  // <svg>
  var svg = document.createElementNS(SVG, 'svg')
  var boxWidth = graph.graph().width
  var boxHeight = graph.graph().height
  svg.setAttributeNS(null, 'viewBox', '0 0 ' + boxWidth + ' ' + boxHeight)
  svg.setAttributeNS(null, 'height', boxHeight)
  svg.setAttributeNS(null, 'width', boxWidth)
  svg.setAttribute('class', 'graph')

  // <title>
  var title = document.createElementNS(SVG, 'title')
  svg.appendChild(title)
  title.appendChild(document.createTextNode('Graph of Drafts'))

  // Add SVG styles.
  var style = document.createElementNS(SVG, 'style')
  style.appendChild(document.createTextNode(`
    a[href] {
      cursor: pointer;
      text-decoration: none;
    }
  `))
  svg.appendChild(style)

  var defs = document.createElementNS(SVG, 'defs')
  svg.appendChild(defs)

  // Arrow Marker
  var arrowMarker = document.createElementNS(SVG, 'marker')
  defs.appendChild(arrowMarker)
  arrowMarker.setAttributeNS(null, 'id', 'arrow')
  arrowMarker.setAttributeNS(null, 'markerWidth', 10)
  arrowMarker.setAttributeNS(null, 'markerHeight', 10)
  arrowMarker.setAttributeNS(null, 'refX', 0)
  arrowMarker.setAttributeNS(null, 'refY', 3)
  arrowMarker.setAttributeNS(null, 'orient', 'auto')
  arrowMarker.setAttributeNS(null, 'markerUnits', 'strokeWidth')

  var arrowPath = document.createElementNS(SVG, 'path')
  arrowMarker.appendChild(arrowPath)
  arrowPath.setAttributeNS(null, 'd', 'M0,0 L0,6 L9,3 z')
  arrowPath.setAttributeNS(null, 'fill', 'black')

  // Render nodes.
  graph.nodes().forEach(function (name) {
    var node = graph.node(name)
    var x = node.x - (node.width / 2)
    var y = node.y - (node.height / 2)
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
    rect.setAttributeNS(null, 'x', x)
    rect.setAttributeNS(null, 'y', y)
    rect.setAttributeNS(null, 'width', node.width)
    rect.setAttributeNS(null, 'height', node.height)
    rect.setAttributeNS(null, 'fill', 'white')
    rect.setAttributeNS(null, 'stroke', 'black')

    var author = document.createElementNS(SVG, 'text')
    a.appendChild(author)
    author.setAttributeNS(null, 'x', node.x)
    author.setAttributeNS(null, 'y', node.y - (node.height / 4))
    author.setAttributeNS(null, 'text-anchor', 'middle')
    author.setAttributeNS(null, 'font-size', '100%')
    author.appendChild(document.createTextNode(
      plainTextIntro(state, brief.publicKey)
    ))

    var timestamp = document.createElementNS(SVG, 'text')
    a.appendChild(timestamp)
    timestamp.setAttributeNS(null, 'class', 'relativeTimestamp')
    timestamp.setAttributeNS(null, 'x', node.x)
    timestamp.setAttributeNS(null, 'y', node.y)
    timestamp.setAttributeNS(null, 'text-anchor', 'middle')
    timestamp.setAttributeNS(null, 'font-size', '80%')
    timestamp.appendChild(document.createTextNode(
      moment(brief.timestamp).fromNow()
    ))

    if (brief.notesCount !== 0) {
      var notesCount = document.createElementNS(SVG, 'text')
      a.appendChild(notesCount)
      notesCount.setAttributeNS(null, 'x', node.x)
      notesCount.setAttributeNS(null, 'y', node.y + (node.height / 4))
      notesCount.setAttributeNS(null, 'text-anchor', 'middle')
      notesCount.setAttributeNS(null, 'font-size', '80%')
      notesCount.appendChild(document.createTextNode(
        brief.notesCount + ' ' +
        (brief.notesCount === 1 ? 'notes' : 'notes')
      ))
    }
  })

  // Render edges.
  graph.edges().forEach(function (nodes) {
    var edge = graph.edge(nodes)
    var polyline = document.createElementNS(SVG, 'polyline')
    svg.appendChild(polyline)
    var points = edge.points
      .map(function (point) {
        return point.x + ' ' + point.y
      })
      .join(', ')
    polyline.setAttributeNS(null, 'points', points)
    polyline.setAttributeNS(null, 'fill', 'none')
    polyline.setAttributeNS(null, 'stroke', 'black')
    polyline.setAttributeNS(null, 'stroke-width', 1)
    polyline.setAttributeNS(null, 'marker-end', 'url(#arrow)')
  })

  return svg
}

function plainTextIntro (state, publicKey) {
  if (publicKey === state.identity.publicKey) return 'you'
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
    .sort(function (a, b) {
      return new Date(a.timestamp) - new Date(b.timestamp)
    })
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
