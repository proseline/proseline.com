var byTimestamp = require('./by-timestamp')
var crypto = require('@proseline/crypto')
var stringify = require('./stringify')

module.exports = function (notes) {
  var map = {}
  notes.forEach(function (note) {
    var digest = crypto.hash(
      Buffer.from(stringify(note.innerEnvelope.entry))
    ).toString('hex')
    note.children = []
    map[digest] = note
  })
  notes.forEach(function (note) {
    var parentDigest = note.innerEnvelope.entry.parent
    if (parentDigest && map[parentDigest]) {
      map[parentDigest].children.push(note)
    }
  })
  notes.forEach(function (note) {
    note.children.sort(byTimestamp)
    note.children.reverse()
  })
  var returned = Object.keys(map)
    .map(function (digest) {
      return map[digest]
    })
    .filter(function (note) {
      return !note.innerEnevelope.entry.parent
    })
  returned.sort(byTimestamp)
  returned.reverse()
  return returned
}
