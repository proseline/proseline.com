const renderHomeLink = require('./home-link')
const renderPeersIcon = require('./peers-icon')
const renderProjectLink = require('./project-link')

module.exports = function (state, addition) {
  const header = document.createElement('header')
  header.className = 'draftHeader'
  header.appendChild(renderHomeLink())
  if (state.route !== 'home') {
    if (state.route === 'project') {
      const a = document.createElement('a')
      header.appendChild(a)
      a.className = 'project'
      a.appendChild(document.createTextNode(state.title))
    } else {
      header.appendChild(renderProjectLink(state))
    }
  }
  header.appendChild(renderPeersCounter(state))
  if (addition) header.appendChild(addition)
  return header
}

function renderPeersCounter (state) {
  const p = document.createElement('p')
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
