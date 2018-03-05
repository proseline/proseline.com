var assert = require('assert')

module.exports = function (state, publicKey, plainText) {
  assert.equal(typeof state, 'object')
  assert.equal(typeof publicKey, 'string')
  var element
  if (plainText) {
    element = document.createElement('span')
  } else {
    element = document.createElement('a')
    element.href = (
      '/projects/' + state.discoveryKey +
      '/members/' + publicKey
    )
  }
  element.className = 'intro'
  var intro = state.intros[publicKey]
  if (publicKey === state.identity.publicKey) {
    element.appendChild(document.createTextNode('You'))
  } else if (intro) {
    element.appendChild(
      document.createTextNode(
        intro.message.body.name +
        ' (on ' + intro.message.body.device + ')'
      )
    )
  } else {
    element.appendChild(document.createTextNode(
      'An anonymous user'
    ))
  }
  return element
}
