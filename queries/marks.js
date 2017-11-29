module.exports = function (db, digest, callback) {
  var transaction = db.transaction(['marks'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('marks')
  var index = objectStore.index('draft')
  var request = index.openCursor(digest)
  var marks = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      var value = cursor.value
      marks.push(value)
      cursor.continue()
    } else {
      callback(null, marks)
    }
  }
}
