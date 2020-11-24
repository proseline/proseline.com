module.exports = function (state) {
  state.route = 'not found'
  const main = document.createElement('main')
  main.appendChild(document.createTextNode('Not Found'))
  return main
}
