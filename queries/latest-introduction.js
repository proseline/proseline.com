module.exports = function (db, publicKey, callback) {
  var transaction = db.transaction(['introductions'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('introductions')
  var index = objectStore.index('public')
  var request = index.openCursor(publicKey)
  var introduction
  var outdated = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      var value = cursor.value
      value.digest = cursor.primaryKey
      if (introduction === undefined) {
        introduction = value
      } else {
        var thisDate = new Date(value.payload.timestamp)
        var currentDate = new Date(introduction.payload.timestamp)
        if (thisDate > currentDate) {
          outdated.push(introduction.digest)
          introduction = value
        }
      }
      cursor.continue()
    } else {
      deleteOldIntroductions(db, outdated, function (error) {
        if (error) console.error(error)
        callback(null, introduction)
      })
    }
  }
}

function deleteOldIntroductions (db, digests, callback) {
  var transaction = db.transaction(['introductions'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  transaction.oncomplete = function () {
    callback()
  }
  var objectStore = transaction.objectStore('introductions')
  digests.forEach(function (digest) {
    objectStore.delete(digest)
  })
}
