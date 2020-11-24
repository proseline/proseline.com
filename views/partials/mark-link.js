const renderMark = require('./mark')

module.exports = (state, mark) => {
  const a = document.createElement('a')
  a.className = 'draft'
  a.href = (
    '/projects/' + mark.discoveryKey +
    '/marks/' + mark.envelope.logPublicKey +
    ':' + mark.identifier
  )
  a.title = 'Click to view the history of this mark.'
  a.appendChild(renderMark(mark, state))
  return a
}
