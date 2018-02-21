var renderHomeButton = require('./home-button')
var renderProjectLink = require('./project-link')

module.exports = function (state, addition) {
  var header = document.createElement('header')
  header.appendChild(renderHomeButton())
  header.appendChild(renderProjectLink(state))
  if (addition) header.appendChild(addition)
  return header
}
