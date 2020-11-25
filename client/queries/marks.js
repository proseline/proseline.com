module.exports = (db, digest, callback) => {
  const transaction = db.transaction(['marks'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore('marks')
  const index = objectStore.index('draft')
  const request = index.openCursor(digest)
  const marks = []
  request.onsuccess = function () {
    const cursor = request.result
    if (cursor) {
      const value = cursor.value
      marks.push(value)
      cursor.continue()
    } else {
      callback(null, marks)
    }
  }
}
