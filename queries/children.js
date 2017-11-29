module.exports = function (db, digest, callback) {
  var transaction = db.transaction(['drafts'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('drafts')
  var index = objectStore.index('parents')
  var request = index.openCursor(digest)
  var children = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      var value = cursor.value
      value.digest = cursor.primaryKey
      children.push(value)
      cursor.continue()
    } else {
      callback(null, children)
    }
  }
}
