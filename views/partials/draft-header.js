var renderHomeLink = require('./home-link')
var renderPeersIcon = require('./peers-icon')
var renderProjectLink = require('./project-link')

module.exports = function (state, addition) {
  var header = document.createElement('header')
  header.className = 'draftHeader'
  header.appendChild(renderHomeLink())
  if (state.route !== 'home') {
    header.appendChild(renderProjectLink(state))
  }
  header.appendChild(renderPeersCounter(state))
  if (addition) header.appendChild(addition)
  return header
}

function renderPeersCounter (state) {
  var p = document.createElement('p')
  p.className = 'peers'
  p.appendChild(renderPeersIcon())
  p.appendChild(document.createTextNode(state.peers))
  p.title = (
    state.peers.toString() +
    (state.peers === 1 ? 'collaborator' : 'collaborators') +
    ' are online sharing work with you.'
  )
  return p
}
