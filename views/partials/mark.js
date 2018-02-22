var renderIntro = require('./intro')
var renderTimestamp = require('./timestamp')

module.exports = function (mark, state, send) {
  var p = document.createElement('p')

  p.appendChild(renderIntro(state, mark.publicKey))
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
