var renderIntro = require('./intro')
var renderRelativeTimestamp = require('./relative-timestamp')

module.exports = function (state, draftOrBrief) {
  var a = document.createElement('a')
  a.className = 'draft'
  a.href = (
    '/projects/' + draftOrBrief.project +
    '/drafts/' + draftOrBrief.digest
  )
  a.appendChild(renderIntro(state, draftOrBrief.publicKey))
  a.appendChild(document.createTextNode(' '))
  if (draftOrBrief.message) {
    a.appendChild(renderRelativeTimestamp(draftOrBrief.message.body.timestamp))
  } else {
    a.appendChild(renderRelativeTimestamp(draftOrBrief.timestamp))
  }
  return a
}
