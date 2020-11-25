const renderMarkIcon = require('./mark-icon')

module.exports = (mark, state) => {
  const span = document.createElement('span')
  span.className = 'markName'
  span.appendChild(renderMarkIcon())
  span.appendChild(document.createTextNode(mark.name))
  return span
}
