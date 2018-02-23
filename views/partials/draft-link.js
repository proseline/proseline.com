var renderIntro = require('./intro')
var relativeTimestamp = require('./relative-timestamp')

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
    a.appendChild(relativeTimestamp(draftOrBrief.message.body.timestamp))
  } else {
    a.appendChild(relativeTimestamp(draftOrBrief.timestamp))
  }
  return a
}
