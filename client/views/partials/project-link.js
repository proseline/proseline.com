module.exports = state => {
  const a = document.createElement('a')
  a.className = 'project'
  a.appendChild(document.createTextNode(state.title))
  a.href = '/projects/' + state.discoveryKey
  return a
}
