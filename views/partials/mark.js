var renderTimestamp = require('./timestamp')

module.exports = function (mark, state, send) {
  var own = mark.publicKey === state.identity.publicKey
  var intro = state.intros[mark.publicKey]
  var div = document.createElement('div')
  var name = document.createElement('span')
  name.className = 'markName'
  name.appendChild(document.createTextNode(mark.payload.name))
  div.appendChild(name)
  div.appendChild(renderTimestamp(mark.payload.timestamp))
  var user = document.createElement('span')
  user.className = 'intro'
  if (own) {
    user.appendChild(document.createTextNode('(yours)'))
    // TODO: Delete mark button.
  } else if (intro) {
    user.appendChild(
      document.createTextNode(
        intro.payload.name + ' on ' + intro.payload.device
      )
    )
  }
  div.appendChild(user)
  return div
}
