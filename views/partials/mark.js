var renderMarkIcon = require('./mark-icon')

module.exports = function (mark, state) {
  var span = document.createElement('span')
  span.className = 'markName'
  span.appendChild(renderMarkIcon())
  span.appendChild(document.createTextNode(mark.entry.body.name))
  return span
}
