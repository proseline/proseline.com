const EventEmitter = require('events').EventEmitter
const IDBKeyRange = require('./idbkeyrange')
const IndexedDB = require('./indexeddb')
const inherits = require('inherits')

// Database serves as base prototype for wrappers around IndexedDB
// databases. Other database wrapper prototypes extend Database.
module.exports = Database

function Database (options) {
  this._name = options.name
  this._version = options.version
  this._initialized = false
  this.ready = false
}

inherits(Database, EventEmitter)

const prototype = Database.prototype

prototype.init = function (callback) {
  const self = this
  if (self._initialized) return
  const request = IndexedDB.open(this._name, this._version)
  request.onsuccess = function () {
    self._db = request.result
    self.ready = true
    self.emit('ready')
    callback()
  }
  request.onupgradeneeded = function (event) {
    self._upgrade(request.result, event.oldVersion, function () { })
  }
  request.onerror = function () {
    callback(request.error)
  }
}

prototype._get = function (store, key, callback) {
  const transaction = this._db.transaction([store], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore(store)
  const request = objectStore.get(key)
  request.onsuccess = function () {
    callback(null, request.result)
  }
}

prototype._getFromIndex = function (store, indexName, key, callback) {
  const transaction = this._db.transaction([store], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore(store)
  const index = objectStore.index(indexName)
  const request = index.get(key)
  request.onsuccess = function () {
    callback(null, request.result)
  }
}

prototype._put = function (store, key, value, callback) {
  const transaction = this._db.transaction([store], 'readwrite')
  transaction.oncomplete = function () {
    callback()
  }
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore(store)
  objectStore.put(value, key)
}

prototype._delete = function (store, key, callback) {
  const transaction = this._db.transaction([store], 'readwrite')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore(store)
  const request = objectStore.delete(key)
  request.onsuccess = function () {
    callback()
  }
}

prototype._list = function (store, iterator, callback) {
  const transaction = this._db.transaction([store], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore(store)
  const request = objectStore.openCursor()
  const results = []
  request.onsuccess = function () {
    const cursor = request.result
    if (cursor) {
      results.push(iterator(cursor))
      cursor.continue()
    } else {
      callback(null, results)
    }
  }
}

prototype._listIndexedValues = function (store, indexName, callback) {
  const transaction = this._db.transaction([store], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore(store)
  const index = objectStore.index(indexName)
  const request = index.openKeyCursor()
  const results = []
  request.onsuccess = function () {
    const cursor = request.result
    if (cursor) {
      const key = cursor.key
      if (results.indexOf(key) === -1) results.push(key)
      cursor.continue()
    } else {
      callback(null, results)
    }
  }
}

prototype._listValues = function (store, callback) {
  this._list(store, function (cursor) {
    return cursor.value
  }, callback)
}

prototype._count = function (storeName, lower, upper, callback) {
  const transaction = this._db.transaction([storeName], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore(storeName)
  const request = objectStore.count(IDBKeyRange.bound(lower, upper))
  request.onsuccess = function () {
    callback(null, request.result)
  }
}

prototype._indexQuery = function (storeName, indexName, key, callback) {
  const transaction = this._db.transaction([storeName], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore(storeName)
  const index = objectStore.index(indexName)
  const request = index.openCursor(IDBKeyRange.only(key))
  const results = []
  request.onsuccess = function () {
    const cursor = request.result
    if (cursor) {
      results.push(cursor.value)
      cursor.continue()
    } else {
      callback(null, results)
    }
  }
}

prototype._indexCount = function (storeName, indexName, key, callback) {
  const transaction = this._db.transaction([storeName], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore(storeName)
  const index = objectStore.index(indexName)
  const request = index.count(key)
  request.onsuccess = function () {
    callback(null, request.result)
  }
}
