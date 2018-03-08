var renderDraftIcon = require('./draft-icon')
var renderIntro = require('./intro')

module.exports = function (state, draftOrBrief) {
  var a = document.createElement('a')
  a.className = 'draft'
  a.href = (
    '/projects/' + draftOrBrief.project +
    '/drafts/' + draftOrBrief.digest
  )
  a.title = 'Click to read the draft.'
  a.appendChild(renderDraftIcon())
  a.appendChild(renderIntro(state, draftOrBrief.publicKey, {
    noIcon: true,
    possessive: true,
    plainText: true
  }))
  var parents = draftOrBrief.parents || draftOrBrief.message.body.parents
  if (parents.length === 0) {
    a.appendChild(document.createTextNode(' original draft'))
  } else if (parents.length === 1) {
    a.appendChild(document.createTextNode(' draft'))
  } else {
    a.appendChild(document.createTextNode(' combining draft'))
  }
  return a
}
