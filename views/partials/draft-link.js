var renderIntro = require('./intro')
var renderTimestamp = require('./timestamp')

module.exports = function (state, draftOrBrief) {
  var a = document.createElement('a')
  a.className = 'draft'
  a.href = (
    '/projects/' + draftOrBrief.project +
    '/drafts/' + draftOrBrief.digest
  )
  a.appendChild(renderIntro(state, draftOrBrief.publicKey))
  a.appendChild(document.createTextNode(' on '))
  if (draftOrBrief.message) {
    a.appendChild(renderTimestamp(draftOrBrief.message.body.timestamp))
  } else {
    a.appendChild(renderTimestamp(draftOrBrief.timestamp))
  }
  return a
}
