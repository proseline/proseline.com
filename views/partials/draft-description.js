module.exports = function (draftOrBrief, options) {
  options = options || {}
  var parents = draftOrBrief.parents || draftOrBrief.innerEnvelope.entry.parents
  var text
  if (parents.length === 0) text = 'original draft'
  else if (parents.length === 1) text = 'revising draft'
  else text = 'combining draft'
  if (options.determiner) {
    if (text[0] === 'o') text = 'an ' + text
    else text = 'a ' + text
  }
  return document.createTextNode(text)
}
