module.exports = function (state) {
  state.route = 'not found'
  var main = document.createElement('main')
  main.appendChild(document.createTextNode('Not Found'))
  return main
}
