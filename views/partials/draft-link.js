const renderDraftDescription = require('./draft-description')
const renderDraftIcon = require('./draft-icon')
const renderIntro = require('./intro')

module.exports = function (state, draftOrBrief) {
  const a = document.createElement('a')
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
