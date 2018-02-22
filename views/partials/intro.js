var assert = require('assert')

module.exports = function (state, publicKey) {
  assert.equal(typeof state, 'object')
  assert.equal(typeof publicKey, 'string')
  var span = document.createElement('span')
  span.className = 'intro'
  var intro = state.intros[publicKey]
  if (publicKey === state.identity.publicKey) {
    span.appendChild(document.createTextNode('You'))
  } else if (intro) {
    span.appendChild(
      document.createTextNode(
        intro.message.body.name +
        ' (on ' + intro.message.body.device + ')'
      )
    )
  } else {
    span.appendChild(document.createTextNode(
      'An anonymous user'
    ))
  }
  return span
}
