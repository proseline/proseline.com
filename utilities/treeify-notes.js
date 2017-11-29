module.exports = function (notes) {
  var map = {}
  notes.forEach(function (note) {
    note.children = []
    map[note.digest] = note
  })
  notes.forEach(function (note) {
    var parentDigest = note.payload.parent
    if (parentDigest && map[parentDigest]) {
      map[parentDigest].children.push(note)
    }
  })
  return Object.keys(map)
    .map(function (digest) {
      return map[digest]
    })
    .filter(function (note) {
      return note.payload.parent === null
    })
}
