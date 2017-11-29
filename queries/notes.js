var getLatestIntro = require('./latest-intro')
var runParallel = require('run-parallel')

module.exports = function (db, digest, callback) {
  getNotes(db, digest, function (error, notes) {
    if (error) return callback(error)
    var publicKeys = []
    notes.forEach(function (note) {
      var publicKey = note.public
      if (!publicKeys.includes(publicKey)) {
        publicKeys.push(publicKey)
      }
    })
    var jobs = {}
    publicKeys.forEach(function (publicKey) {
      jobs[publicKey] = function (done) {
        getLatestIntro(db, publicKey, done)
      }
    })
    runParallel(jobs, function (error, intros) {
      if (error) return callback(error)
      callback(null, {
        notes: treeify(notes),
        intros: intros
      })
    })
  })
}

function treeify (notes) {
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

function getNotes (db, digest, callback) {
  var transaction = db.transaction(['notes'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('notes')
  var index = objectStore.index('draft')
  var request = index.openCursor(digest)
  var notes = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      var value = cursor.value
      value.digest = cursor.primaryKey
      notes.push(value)
      cursor.continue()
    } else {
      callback(null, notes)
    }
  }
}
