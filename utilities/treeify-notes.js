var byTimestamp = require('./by-timestamp')
var hash = require('../crypto/hash')
var stringify = require('json-stable-stringify')

module.exports = function (notes) {
  var map = {}
  notes.forEach(function (note) {
    note.children = []
    map[hash(stringify(note.entry))] = note
  })
  notes.forEach(function (note) {
    var parentDigest = note.entry.payload.parent
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
      return note.entry.payload.parent === null
    })
  returned.sort(byTimestamp)
  returned.reverse()
  return returned
}
