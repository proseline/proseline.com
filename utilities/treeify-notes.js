var byTimestamp = require('./by-timestamp')

module.exports = function (notes) {
  var map = {}
  notes.forEach(function (note) {
    note.children = []
    map[note.digest] = note
  })
  notes.forEach(function (note) {
    var parentDigest = note.parent
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
      return !note.parent
    })
  returned.sort(byTimestamp)
  returned.reverse()
  return returned
}
