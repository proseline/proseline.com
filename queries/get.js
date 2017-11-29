module.exports = function (db, store, key, callback) {
  var transaction = db.transaction([store], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore(store)
  var request = objectStore.get(key)
  request.onsuccess = function () {
    callback(null, request.result)
  }
}
