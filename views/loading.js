const assert = require('nanoassert')

module.exports = function (onLoadEvent, text) {
  assert(typeof onLoadEvent === 'function')
  if (text) assert(typeof text === 'string')
  onLoadEvent()
  const section = document.createElement('section')
  section.appendChild(document.createTextNode(text || 'Loading…'))
  return section
}
