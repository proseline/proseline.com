module.exports = function (state, publicKey) {
  var span = document.createElement('span')
  span.className = 'intro'
  var intro = state.intros[publicKey]
  if (intro) {
    if (intro.publicKey === state.identity.publicKey) {
      span.appendChild(document.createTextNode('You'))
    } else {
      span.appendChild(
        document.createTextNode(
          intro.message.body.name +
          ' (on ' + intro.message.body.device + ')'
        )
      )
    }
  } else {
    span.appendChild(document.createTextNode(publicKey))
  }
  return span
}
