var assert = require('assert')

module.exports = function loading (onLoadEvent, text) {
  assert(typeof onLoadEvent === 'function')
  if (text) assert.equal(typeof text, 'string')
  onLoadEvent()
  var section = document.createElement('section')
  section.appendChild(document.createTextNode(text || 'Loading…'))
  return section
}
