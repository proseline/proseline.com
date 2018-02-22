var renderIntro = require('./intro')
var renderTimestamp = require('./timestamp')

module.exports = function (state, draft) {
  var a = document.createElement('a')
  a.href = (
    '/projects/' + draft.project +
    '/drafts/' + draft.digest
  )
  a.appendChild(renderIntro(state, draft.publicKey))
  a.appendChild(document.createTextNode(' on '))
  a.appendChild(renderTimestamp(draft.message.body.timestamp))
  return a
}
