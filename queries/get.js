module.exports = function (db, store, key, callback) {
  const transaction = db.transaction([store], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore(store)
  const request = objectStore.get(key)
  request.onsuccess = function () {
    callback(null, request.result)
  }
}
