var renderMark = require('./mark')

module.exports = function (state, mark) {
  var a = document.createElement('a')
  a.className = 'draft'
  a.href = (
    '/projects/' + mark.discoveryKey +
    '/marks/' + mark.logPublicKey +
    ':' + mark.identifier
  )
  a.title = 'Click to view the history of this mark.'
  a.appendChild(renderMark(mark, state))
  return a
}
