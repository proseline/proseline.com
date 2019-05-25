module.exports = function (state) {
  var a = document.createElement('a')
  a.className = 'project'
  a.appendChild(document.createTextNode(state.title))
  a.href = '/projects/' + state.projectDiscoveryKey
  return a
}
