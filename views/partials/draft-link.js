var renderIntro = require('./intro')
var renderTimestamp = require('./timestamp')

module.exports = function (state, draft) {
  var a = document.createElement('a')
  a.className = 'draft'
  a.href = (
    '/projects/' + draft.project +
    '/drafts/' + draft.digest
  )
  a.appendChild(renderIntro(state, draft.publicKey))
  a.appendChild(document.createTextNode(' on '))
  if (draft.message) {
    a.appendChild(renderTimestamp(draft.message.body.timestamp))
  } else {
    a.appendChild(renderTimestamp(draft.timestamp))
  }
  return a
}
