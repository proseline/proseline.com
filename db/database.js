var IndexedDB = require('./indexeddb')
var IDBKeyRange = require('./idbkeyrange')

module.exports = Database

function Database (options) {
  this._name = options.name
  this._version = options.version
}

var prototype = Database.prototype

prototype.init = function (callback) {
  var self = this
  var request = IndexedDB.open(this._name, this._version)
  request.onsuccess = function () {
    self._db = request.result
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
  var transaction = this._db.transaction([store], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore(store)
  var request = objectStore.get(key)
  request.onsuccess = function () {
    callback(null, request.result)
  }
}

prototype._getFromIndex = function (store, indexName, key, callback) {
  var transaction = this._db.transaction([store], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore(store)
  var index = objectStore.index(indexName)
  var request = index.get(key)
  request.onsuccess = function () {
    callback(null, request.result)
  }
}

prototype._put = function (store, key, value, callback) {
  var transaction = this._db.transaction([store], 'readwrite')
  transaction.oncomplete = function () {
    callback()
  }
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore(store)
  objectStore.put(value, key)
}

prototype._delete = function (store, key, callback) {
  var transaction = this._db.transaction([store], 'readwrite')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore(store)
  var request = objectStore.delete(key)
  request.onsuccess = function () {
    callback()
  }
}

prototype._list = function (store, iterator, callback) {
  var transaction = this._db.transaction([store], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore(store)
  var request = objectStore.openCursor()
  var results = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      results.push(iterator(cursor))
      cursor.continue()
    } else {
      callback(null, results)
    }
  }
}

prototype._listIndexedValues = function (store, indexName, callback) {
  var transaction = this._db.transaction([store], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore(store)
  var index = objectStore.index(indexName)
  var request = index.openKeyCursor()
  var results = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      var key = cursor.key
      if (results.indexOf(key) === -1) results.push(key)
      cursor.continue()
    } else {
      callback(null, results)
    }
  }
}

prototype._listKeysAndValues = function (store, callback) {
  this._list(store, function (cursor) {
    return {
      key: cursor.key,
      value: cursor.value
    }
  }, callback)
}

prototype._listKeys = function (store, callback) {
  this._list(store, function (cursor) {
    return cursor.key
  }, callback)
}

prototype._listValues = function (store, callback) {
  this._list(store, function (cursor) {
    return cursor.value
  }, callback)
}

prototype._count = function (storeName, lower, upper, callback) {
  var transaction = this._db.transaction([storeName], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore(storeName)
  var request = objectStore.count(IDBKeyRange.bound(lower, upper))
  request.onsuccess = function () {
    callback(null, request.result)
  }
}

prototype._countFromIndex = function (storeName, indexName, lower, upper, callback) {
  var transaction = this._db.transaction([storeName], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore(storeName)
  var index = objectStore.index(indexName)
  var request = index.count(IDBKeyRange.bound(lower, upper))
  request.onsuccess = function () {
    callback(null, request.result)
  }
}
