var assert = require('assert')
var renderIntroIcon = require('./intro-icon')

module.exports = function (state, logPublicKey, options) {
  assert.strictEqual(typeof state, 'object')
  assert.strictEqual(typeof logPublicKey, 'string')
  options = options || {}
  var element
  if (options.plainText) {
    element = document.createElement('span')
  } else {
    element = document.createElement('a')
    element.href = (
      '/projects/' + state.projectDiscoveryKey +
      '/members/' + logPublicKey
    )
    element.title = 'Click to view activity.'
  }
  element.className = 'intro'
  if (!options.noIcon) element.appendChild(renderIntroIcon())
  var intro = state.intros[logPublicKey]
  if (logPublicKey === state.identity.logPublicKey) {
    var word = options.possessive ? 'your' : 'you'
    if (options.capitalize) word = word[0].toUpperCase() + word.slice(1)
    element.appendChild(document.createTextNode(word))
  } else if (intro) {
    element.appendChild(
      document.createTextNode(
        intro.innerEnvelope.entry.name +
        ' (on ' + intro.innerEnvelope.entry.device + ')' +
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
