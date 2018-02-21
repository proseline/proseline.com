module.exports = function (state) {
  var a = document.createElement('a')
  a.appendChild(document.createTextNode(state.title))
  a.href = '/projects/' + state.discoveryKey
  return a
}
