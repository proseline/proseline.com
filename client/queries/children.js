module.exports = (db, digest, callback) => {
  const transaction = db.transaction(['drafts'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore('drafts')
  const index = objectStore.index('parents')
  const request = index.openCursor(digest)
  const children = []
  request.onsuccess = function () {
    const cursor = request.result
    if (cursor) {
      const value = cursor.value
      value.digest = cursor.primaryKey
      children.push(value)
      cursor.continue()
    } else {
      callback(null, children)
    }
  }
}
