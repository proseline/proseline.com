var assert = require('assert')
var renderIntroIcon = require('./intro-icon')

module.exports = function (state, publicKey, options) {
  assert.strictEqual(typeof state, 'object')
  assert.strictEqual(typeof publicKey, 'string')
  options = options || {}
  var element
  if (options.plainText) {
    element = document.createElement('span')
  } else {
    element = document.createElement('a')
    element.href = (
      '/projects/' + state.projectDiscoveryKey +
      '/members/' + publicKey
    )
    element.title = 'Click to view activity.'
  }
  element.className = 'intro'
  if (!options.noIcon) element.appendChild(renderIntroIcon())
  var intro = state.intros[publicKey]
  if (publicKey === state.identity.publicKey) {
    var word = options.possessive ? 'your' : 'you'
    if (options.capitalize) word = word[0].toUpperCase() + word.slice(1)
    element.appendChild(document.createTextNode(word))
  } else if (intro) {
    element.appendChild(
      document.createTextNode(
        intro.entry.body.name +
        ' (on ' + intro.entry.body.device + ')' +
        (options.possessive ? '’s' : '')
      )
    )
  } else {
    element.appendChild(document.createTextNode(
      'An anonymous user' +
      (options.possessive ? '’s' : '')
    ))
  }
  return element
}
