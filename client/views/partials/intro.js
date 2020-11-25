const assert = require('nanoassert')
const renderIntroIcon = require('./intro-icon')

module.exports = (state, logPublicKey, { plainText, noIcon, possessive, capitalize }) => {
  assert(typeof state === 'object')
  assert(typeof logPublicKey === 'string')
  let element
  if (plainText) {
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
  if (!noIcon) element.appendChild(renderIntroIcon())
  const intro = state.intros[logPublicKey]
  if (logPublicKey === state.logKeyPair.publicKey) {
    let word = possessive ? 'your' : 'you'
    if (capitalize) word = word[0].toUpperCase() + word.slice(1)
    element.appendChild(document.createTextNode(word))
  } else if (intro) {
    element.appendChild(
      document.createTextNode(
        intro.name +
        ' (on ' + intro.device + ')' +
        (possessive ? '’s' : '')
      )
    )
  } else {
    element.appendChild(document.createTextNode(
      'An anonymous user' +
      (possessive ? '’s' : '')
    ))
  }
  return element
}
