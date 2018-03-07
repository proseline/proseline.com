module.exports = function (state, mark) {
  var a = document.createElement('a')
  a.className = 'draft'
  a.href = (
    '/projects/' + mark.message.project +
    '/marks/' + mark.publicKey +
    ':' + mark.message.body.identifier
  )
  a.title = 'Click to view the history of this mark.'
  a.appendChild(document.createTextNode(mark.message.body.name))
  return a
}
