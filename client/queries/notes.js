module.exports = (db, digest, callback) => {
  const transaction = db.transaction(['notes'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore('notes')
  const index = objectStore.index('draft')
  const request = index.openCursor(digest)
  const notes = []
  request.onsuccess = function () {
    const cursor = request.result
    if (cursor) {
      const value = cursor.value
      value.digest = cursor.primaryKey
      notes.push(value)
      cursor.continue()
    } else {
      callback(null, notes)
    }
  }
}
