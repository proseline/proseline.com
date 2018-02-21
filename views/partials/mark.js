var renderTimestamp = require('./timestamp')

module.exports = function (mark, state, send) {
  var own = mark.publicKey === state.identity.publicKey
  var intro = state.intros[mark.publicKey]
  var p = document.createElement('p')

  var user = document.createElement('span')
  user.className = 'intro'
  if (own) {
    user.appendChild(document.createTextNode('You'))
    // TODO: Delete mark button.
  } else if (intro) {
    user.appendChild(
      document.createTextNode(
        intro.message.body.name + ' on ' + intro.message.body.device
      )
    )
  }
  p.appendChild(user)

  p.appendChild(document.createTextNode(' put the marker '))

  var name = document.createElement('span')
  name.className = 'markName'
  name.appendChild(document.createTextNode(mark.message.body.name))
  p.appendChild(name)

  p.appendChild(document.createTextNode(' on this draft on '))

  p.appendChild(renderTimestamp(mark.message.body.timestamp))
  p.appendChild(document.createTextNode('.'))

  return p
}
