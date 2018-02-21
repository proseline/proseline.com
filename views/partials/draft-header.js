var renderHomeLink = require('./home-link')
var renderProjectLink = require('./project-link')

module.exports = function (state, addition) {
  var header = document.createElement('header')
  header.appendChild(renderHomeLink())
  header.appendChild(renderProjectLink(state))
  if (addition) header.appendChild(addition)
  return header
}
