var assert = require('assert')

module.exports = function (state, publicKey) {
  assert.equal(typeof state, 'object')
  assert.equal(typeof publicKey, 'string')
  var a = document.createElement('a')
  a.className = 'intro'
  a.href = (
    '/projects/' + state.discoveryKey +
    '/members/' + publicKey
  )
  var intro = state.intros[publicKey]
  if (publicKey === state.identity.publicKey) {
    a.appendChild(document.createTextNode('You'))
  } else if (intro) {
    a.appendChild(
      document.createTextNode(
        intro.message.body.name +
        ' (on ' + intro.message.body.device + ')'
      )
    )
  } else {
    a.appendChild(document.createTextNode(
      'An anonymous user'
    ))
  }
  return a
}
