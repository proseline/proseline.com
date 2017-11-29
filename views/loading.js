var assert = require('assert')

module.exports = function loading (onLoadEvent) {
  assert(typeof onLoadEvent === 'function')
  onLoadEvent()
  var section = document.createElement('section')
  section.appendChild(document.createTextNode('Loading…'))
  return section
}
