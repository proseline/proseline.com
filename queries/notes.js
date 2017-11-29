module.exports = function (db, digest, callback) {
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
