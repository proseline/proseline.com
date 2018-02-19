var renderTimestamp = require('./timestamp')

module.exports = function (mark, state, send) {
  var own = mark.publicKey === state.identity.publicKey
  var intro = state.intros[mark.publicKey]
  var div = document.createElement('div')
  var name = document.createElement('span')
  name.className = 'markName'
  name.appendChild(document.createTextNode(mark.message.body.name))
  div.appendChild(name)
  div.appendChild(document.createTextNode(' — '))
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
  div.appendChild(user)
  div.appendChild(document.createTextNode(' — '))
  div.appendChild(renderTimestamp(mark.message.body.timestamp))
  return div
}
