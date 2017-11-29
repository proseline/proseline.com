var renderTimestamp = require('./timestamp')

module.exports = function (mark, state, send) {
  var intro = state.markIntroductions[mark.public]
  var own = intro && intro.digest === state.introduction.digest
  var div = document.createElement('div')
  var name = document.createElement('span')
  name.className = 'markName'
  name.appendChild(document.createTextNode(mark.payload.name))
  div.appendChild(name)
  div.appendChild(renderTimestamp(mark.payload.timestamp))
  if (intro) {
    var user = document.createElement('span')
    user.className = 'introduction'
    if (own) {
      user.appendChild(document.createTextNode('(yours)'))
      // TODO: Delete mark button.
    } else {
      user.appendChild(
        document.createTextNode(
          intro.payload.name + ' on ' + intro.payload.device
        )
      )
    }
    div.appendChild(user)
  }
  return div
}
