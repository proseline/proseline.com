var assert = require('nanoassert')
var renderIntroIcon = require('./intro-icon')

module.exports = function (state, logPublicKey, options) {
  assert(typeof state === 'object')
  assert(typeof logPublicKey === 'string')
  options = options || {}
  var element
  if (options.plainText) {
    element = document.createElement('span')
  } else {
    element = document.createElement('a')
    element.href = (
      '/projects/' + state.discoveryKey +
      '/members/' + logPublicKey
    )
    element.title = 'Click to view activity.'
  }
  element.className = 'intro'
  if (!options.noIcon) element.appendChild(renderIntroIcon())
  var intro = state.intros[logPublicKey]
  if (logPublicKey === state.logKeyPair.publicKey) {
    var word = options.possessive ? 'your' : 'you'
    if (options.capitalize) word = word[0].toUpperCase() + word.slice(1)
    element.appendChild(document.createTextNode(word))
  } else if (intro) {
    element.appendChild(
      document.createTextNode(
        intro.name +
        ' (on ' + intro.device + ')' +
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
