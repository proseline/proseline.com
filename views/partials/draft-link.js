var renderDraftDescription = require('./draft-description')
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
  a.appendChild(renderIntro(state, draftOrBrief.logPublicKey, {
    noIcon: true,
    possessive: true,
    plainText: true
  }))
  a.appendChild(document.createTextNode(' '))
  a.appendChild(renderDraftDescription(draftOrBrief))
  return a
}
