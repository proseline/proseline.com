const SVG = require('../svg')
const assert = require('nanoassert')
const classnames = require('classnames')
const crypto = require('@proseline/crypto')
const dagre = require('dagre')
const identityLine = require('./partials/identity-line')
const moment = require('moment')
const renderActivity = require('./partials/activity')
const renderBookmarkPath = require('./partials/bookmark-path')
const renderDraftHeader = require('./partials/draft-header')
const renderLoading = require('./loading')
const renderRefreshNotice = require('./partials/refresh-notice')
const renderSection = require('./partials/section')
const withProject = require('./with-project')

module.exports = withProject((state, send, discoveryKey) => {
  state.route = 'project'
  const main = document.createElement('main')
  if (state.changed) {
    main.appendChild(renderRefreshNotice(function () {
      send('load project', discoveryKey)
    }))
  }
  main.appendChild(renderDraftHeader(state))
  const intro = state.intros[state.logKeyPair.publicKey]
  const userIntro = state.userIntro
  if (!intro) {
    if (!userIntro) {
      const introSection = renderSection('Introduce Yourself')
      main.appendChild(introSection)
      introSection.appendChild(identityLine(send))
    } else {
      main.appendChild(renderLoading(function () {
        send('introduce')
      }))
    }
  } else {
    main.appendChild(renderWhatsNew(state))
    if (state.draftBriefs.length !== 0) {
      const graphSection = renderSection('Project Map')
      main.appendChild(graphSection)
      graphSection.appendChild(renderGraph(state, send))
    }
    // TODO: Move draft-from-scratch link into graph.
    const newSection = renderSection('Start from Scratch')
    main.appendChild(newSection)
    newSection.appendChild(newDraft(state))
    main.appendChild(renderShareSection(state, send))
    main.appendChild(renderOrganizeSection(state, send))
    main.appendChild(renderRenameSection(state, send))
  }
  return main
})

function renderDeleteExplanation () {
  const p = document.createElement('p')
  p.appendChild(document.createTextNode(
    'Leaving this project deletes it from your computer. ' +
    'To see the project again, you will need an invitation link. ' +
    'Leaving the project does not delete your work from other ' +
    'member’s computers.'
  ))
  return p
}

const CONFIRM_DELETE = 'Do you really want to delete this project?'

function renderDeleteButton (state, send) {
  const button = document.createElement('button')
  button.id = 'deleteProject'
  button.appendChild(document.createTextNode('Leave this project.'))
  button.addEventListener('click', function () {
    if (window.confirm(CONFIRM_DELETE)) {
      send('leave project', state.discoveryKey)
    }
  })
  return button
}

function newDraft (state) {
  const section = document.createElement('section')

  const a = document.createElement('a')
  section.appendChild(a)
  a.className = 'button'
  a.href = '/projects/' + state.discoveryKey + '/drafts/new'
  a.appendChild(document.createTextNode('Start a new draft from scratch.'))

  return section
}

function inviteExplanation () {
  const p = document.createElement('p')
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
  const a = document.createElement('a')
  a.className = 'button'
  const url = inviteURL(state)
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
  const a = document.createElement('a')
  a.className = 'clipboard button'
  const url = inviteURL(state)
  a.setAttribute('data-clipboard-text', url)
  a.appendChild(document.createTextNode('Copy a link for joining this project.'))
  return a
}

function persistent (state, send) {
  if (state.persistent) {
    const p = document.createElement('p')
    p.appendChild(document.createTextNode(
      'You are sharing this project through your subscription.'
    ))
    return p
  }
  const button = document.createElement('button')
  button.onclick = function () {
    send('persist')
  }
  button.appendChild(document.createTextNode(
    'Share this project through your subscription.'
  ))
  return button
}

function inviteURL (state) {
  return (
    'https://proseline.com/join#' +
    [
      state.replicationKey,
      state.encryptionKey,
      state.projectKeyPair.publicKey,
      state.projectKeyPair.secretKey
    ].map(crypto.base64ToHex).join(':')
  )
}

const BRIEF_WIDTH = 85 * 2
const BRIEF_HEIGHT = 110 * 2
const BOOKMARK_WIDTH = 20

function renderGraph (state, send) {
  const briefs = withoutOrphans(state.draftBriefs)
  const graph = new dagre.graphlib.Graph({ directed: true })
  graph.setGraph({})
  graph.setDefaultEdgeLabel(function () { return {} })
  briefs.forEach(brief => {
    graph.setNode(crypto.base64ToHex(brief.digest), {
      brief,
      width: BRIEF_WIDTH,
      height: BRIEF_HEIGHT
    })
    brief.parents.forEach(parent => {
      graph.setEdge(crypto.base64ToHex(brief.digest), parent)
    })
  })
  dagre.layout(graph, {
    rankdir: 'TB',
    align: 'TB',
    nodesep: 50,
    edgesep: 10
  })

  const draftSelection = state.draftSelection

  const MARGIN = 20

  // <svg>
  const svg = document.createElementNS(SVG, 'svg')
  const boxWidth = graph.graph().width + (2 * MARGIN)
  const boxHeight = graph.graph().height + (2 * MARGIN)
  svg.setAttributeNS(null, 'viewBox', '0 0 ' + boxWidth + ' ' + boxHeight)
  svg.setAttributeNS(null, 'height', boxHeight)
  svg.setAttributeNS(null, 'width', boxWidth)
  svg.setAttribute('class', 'graph')

  // <title>
  const title = document.createElementNS(SVG, 'title')
  svg.appendChild(title)
  title.appendChild(document.createTextNode('Graph of Drafts'))

  // Render nodes.
  graph.nodes().forEach(name => {
    const node = graph.node(name)
    const x = node.x + MARGIN - (node.width / 2)
    const y = node.y + MARGIN - (node.height / 2)
    const brief = node.brief
    const digest = brief.digest
    const selected = state.draftSelection === digest

    const g = document.createElementNS(SVG, 'g')
    svg.appendChild(g)

    const rect = document.createElementNS(SVG, 'rect')
    g.appendChild(rect)
    rect.setAttributeNS(null, 'id', 'rect-' + crypto.base64ToHex(digest))
    const time = moment(brief.timestamp)
    const today = time.isAfter(moment().subtract(1, 'days'))
    const thisWeek = time.isAfter(moment().subtract(1, 'days'))
    rect.setAttributeNS(null, 'class', classnames({
      draft: true,
      selected,
      today: today && !selected,
      thisWeek: thisWeek && !today && !selected
    }))
    rect.setAttributeNS(null, 'x', x)
    rect.setAttributeNS(null, 'y', y)
    rect.setAttributeNS(null, 'width', node.width)
    rect.setAttributeNS(null, 'height', node.height)
    rect.setAttributeNS(null, 'fill', 'white')
    rect.setAttributeNS(null, 'stroke', 'black')
    rect.setAttributeNS(null, 'stroke-width', 2)

    const author = document.createElementNS(SVG, 'text')
    g.appendChild(author)
    author.setAttributeNS(null, 'x', node.x + MARGIN)
    author.setAttributeNS(null, 'y', node.y - 2 * (node.height / 6) + MARGIN)
    author.setAttributeNS(null, 'text-anchor', 'middle')
    author.setAttributeNS(null, 'font-size', '100%')
    author.appendChild(document.createTextNode(
      plainTextIntro(state, brief.envelope.logPublicKey)
    ))

    const timestamp = document.createElementNS(SVG, 'text')
    g.appendChild(timestamp)
    timestamp.setAttributeNS(null, 'class', 'relativeTimestamp')
    timestamp.setAttributeNS(null, 'x', node.x + MARGIN)
    timestamp.setAttributeNS(null, 'y', node.y - (node.height / 6) + MARGIN)
    timestamp.setAttributeNS(null, 'text-anchor', 'middle')
    timestamp.setAttributeNS(null, 'font-size', '75%')
    timestamp.appendChild(document.createTextNode(
      moment(brief.timestamp).fromNow()
    ))

    const anchorX = node.x + MARGIN
    const firstPosition = node.y + MARGIN
    const secondPosition = node.y + (node.height / 6) + MARGIN

    if (selected || !draftSelection) {
      g.appendChild(
        renderSVGLink({
          digest,
          label: 'read',
          x: anchorX,
          y: firstPosition,
          href: (
            '/projects/' + state.discoveryKey +
            '/drafts/' + digest
          )
        })
      )
    }

    if (selected) {
      g.appendChild(
        renderSVGLink({
          digest,
          label: 'deselect',
          x: anchorX,
          y: secondPosition,
          onClick: function () { send('deselect draft') }
        })
      )
    } else if (draftSelection) {
      g.appendChild(
        renderSVGLink({
          digest,
          label: 'combine',
          x: anchorX,
          y: firstPosition,
          href: (
            '/projects/' + state.discoveryKey +
            '/drafts/new/' + state.draftSelection
          )
        })
      )
      g.appendChild(
        renderSVGLink({
          digest,
          label: 'compare',
          x: anchorX,
          y: secondPosition,
          href: (
            '/projects/' + state.discoveryKey +
            '/drafts/compare/' + state.draftSelection + ',' + digest
          )
        })
      )
    } else {
      g.appendChild(
        renderSVGLink({
          digest,
          label: 'select',
          x: anchorX,
          y: secondPosition,
          onClick: function () { send('select draft', digest) }
        })
      )
    }

    if (brief.notesCount && brief.notesCount !== 0) {
      const notesWidth = 36
      const noteOffset = 5
      const notesX = node.x + MARGIN + (node.width / 2) - notesWidth - noteOffset
      const notesY = node.y + MARGIN + (node.height / 2) - (notesWidth / 2)

      const notesRect = document.createElementNS(SVG, 'rect')
      g.appendChild(notesRect)
      notesRect.setAttributeNS(null, 'x', notesX)
      notesRect.setAttributeNS(null, 'y', notesY)
      notesRect.setAttributeNS(null, 'width', notesWidth)
      notesRect.setAttributeNS(null, 'height', notesWidth)
      notesRect.setAttributeNS(null, 'stroke', 'black')
      notesRect.setAttributeNS(null, 'stroke-width', 2)
      notesRect.setAttributeNS(null, 'fill', '#ffffa5')

      const notesCountFontSize = 14

      const notesCount = document.createElementNS(SVG, 'text')
      svg.appendChild(notesCount)
      notesCount.setAttributeNS(null, 'x', notesX + (notesWidth / 2))
      notesCount.setAttributeNS(null, 'y', notesY + (notesWidth / 2) + (notesCountFontSize / 2))
      notesCount.setAttributeNS(null, 'text-anchor', 'middle')
      notesCount.setAttributeNS(null, 'font-size', notesCountFontSize)
      notesCount.setAttributeNS(null, 'font-weight', 'bold')
      notesCount.appendChild(document.createTextNode(brief.notesCount))
    }

    const marks = state.projectMarks
      .sort(byTimestamp)
      .filter(mark => {
        return mark.draft === brief.digest
      })
    const othersMarks = []
    const ourMarks = []
    marks.forEach(mark => {
      (mark.envelope.logPublicKey === state.logKeyPair.publicKey ? ourMarks : othersMarks)
        .push(mark)
    })

    if (
      marks.length >
      (
        Math.max(ourMarks.length, 1) +
        Math.max(othersMarks.length, 1)
      )
    ) {
      const marksCount = document.createElementNS(SVG, 'text')
      g.appendChild(marksCount)
      marksCount.setAttributeNS(null, 'x', node.x + MARGIN)
      marksCount.setAttributeNS(null, 'y', node.y + 2 * (node.height / 6) + MARGIN)
      marksCount.setAttributeNS(null, 'text-anchor', 'middle')
      marksCount.setAttributeNS(null, 'font-size', '80%')
      if (ourMarks.length !== 0) {
        marksCount.setAttributeNS(null, 'font-weight', 'bold')
      }
      const text = (ourMarks.length !== 0)
        ? (
            ourMarks[0].name +
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
        renderBookmarkPath(
          node.x + MARGIN + (node.width / 2) - BOOKMARK_WIDTH - 10,
          node.y + MARGIN - (node.height / 2),
          'blue',
          BOOKMARK_WIDTH
        )
      )
    }

    if (ourMarks.length !== 0) {
      svg.appendChild(
        renderBookmarkPath(
          node.x + MARGIN + (node.width / 2) - BOOKMARK_WIDTH - 5,
          node.y + MARGIN - (node.height / 2),
          'red',
          BOOKMARK_WIDTH
        )
      )
    }
  })

  // Render edges.
  graph.edges().forEach(nodes => {
    const edge = graph.edge(nodes)
    const polyline = document.createElementNS(SVG, 'polyline')
    svg.appendChild(polyline)
    const points = edge.points
      .map(point => {
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

function renderSVGLink ({
  label,
  digest,
  x,
  y,
  href,
  onClick
}) {
  assert(typeof label === 'string')
  assert(typeof digest === 'string')
  assert(typeof x === 'number')
  assert(typeof y === 'number')

  const anchor = document.createElementNS(SVG, 'a')
  anchor.setAttributeNS(null, 'id', label + '-' + crypto.base64ToHex(digest))
  if (href) {
    anchor.setAttribute('href', href)
  } else if (onClick) {
    anchor.addEventListener('click', onClick)
  }

  const text = document.createElementNS(SVG, 'text')
  anchor.appendChild(text)
  text.appendChild(document.createTextNode(label))
  text.setAttributeNS(null, 'x', x)
  text.setAttributeNS(null, 'y', y)
  text.setAttributeNS(null, 'text-anchor', 'middle')

  return anchor
}

function plainTextIntro (state, logPublicKey) {
  if (logPublicKey === state.logKeyPair.publicKey) return 'You'
  const intro = state.intros[logPublicKey]
  if (intro) {
    return intro.name
  } else {
    return 'anonymous'
  }
}

function withoutOrphans (briefs) {
  const digestsSeen = new Set()
  return briefs
    .sort(byTimestamp)
    .filter(function removeOrphans (brief) {
      digestsSeen.add(brief.digest)
      return (
        brief.parents.length === 0 ||
        brief.parents.some(parent => {
          return digestsSeen.has(parent)
        })
      )
    })
}

function renderShareSection (state, send) {
  const section = renderSection('Share')
  section.appendChild(inviteExplanation())
  section.appendChild(inviteViaEMail(state))
  section.appendChild(copyInvitation(state))
  if (state.subscription.email) {
    section.appendChild(persistent(state, send))
  }
  return section
}

function renderOrganizeSection (state, send) {
  const section = renderSection('Organize')
  section.appendChild(renderDeleteExplanation())
  section.appendChild(renderDeleteButton(state, send))
  return section
}

function renderRenameSection (state, send) {
  const section = renderSection('Rename')
  section.appendChild(renderRenameExplanation())
  section.appendChild(renderRename(state, send))
  return section
}

function renderRenameExplanation () {
  const p = document.createElement('p')
  p.appendChild(document.createTextNode(
    'Renaming the project changes your name for the project. ' +
    'Other members of the project cannot see the name you use.'
  ))
  return p
}

function renderRename (state, send) {
  const form = document.createElement('form')
  form.addEventListener('submit', event => {
    event.preventDefault()
    event.stopPropagation()
    send('rename', input.value)
  })

  const input = document.createElement('input')
  form.appendChild(input)
  input.requred = true
  input.value = state.title

  const button = document.createElement('button')
  form.appendChild(button)
  button.type = 'submit'
  button.appendChild(document.createTextNode('Rename this project.'))

  return form
}

function renderWhatsNew (state) {
  const section = renderSection('What’s New')
  section.appendChild(renderActivity(state, state.activity))
  return section
}

function byTimestamp (a, b) {
  return new Date(a.timestamp) - new Date(b.timestamp)
}
