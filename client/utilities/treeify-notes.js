const byTimestamp = require('./by-timestamp')

module.exports = notes => {
  const map = {}
  notes.forEach(note => {
    note.children = []
    map[note.digest] = note
  })
  notes.forEach(note => {
    const parentDigest = note.parent
    if (parentDigest && map[parentDigest]) {
      map[parentDigest].children.push(note)
    }
  })
  notes.forEach(note => {
    note.children.sort(byTimestamp)
    note.children.reverse()
  })
  const returned = Object.keys(map)
    .map(digest => {
      return map[digest]
    })
    .filter(note => {
      return !note.parent
    })
  returned.sort(byTimestamp)
  returned.reverse()
  return returned
}
