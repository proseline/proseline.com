var renderHomeButton = require('./home-button')

module.exports = function (state, addition) {
  var header = document.createElement('header')

  header.appendChild(renderHomeButton())

  var project = document.createElement('a')
  project.className = 'button'
  project.appendChild(document.createTextNode(state.title))
  project.href = '/projects/' + state.discoveryKey
  header.appendChild(project)

  if (addition) header.appendChild(addition)

  return header
}
