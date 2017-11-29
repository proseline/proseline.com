module.exports = function (db, publicKey, callback) {
  var transaction = db.transaction(['intros'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('intros')
  var index = objectStore.index('public')
  var request = index.openCursor(publicKey)
  var intro
  var outdated = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      var value = cursor.value
      value.digest = cursor.primaryKey
      if (intro === undefined) {
        intro = value
      } else {
        var thisDate = new Date(value.payload.timestamp)
        var currentDate = new Date(intro.payload.timestamp)
        if (thisDate > currentDate) {
          outdated.push(intro.digest)
          intro = value
        }
      }
      cursor.continue()
    } else {
      deleteOldIntros(db, outdated, function (error) {
        if (error) console.error(error)
        callback(null, intro)
      })
    }
  }
}

function deleteOldIntros (db, digests, callback) {
  var transaction = db.transaction(['intros'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  transaction.oncomplete = function () {
    callback()
  }
  var objectStore = transaction.objectStore('intros')
  digests.forEach(function (digest) {
    objectStore.delete(digest)
  })
}
