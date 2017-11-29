var hash = require('./crypto/hash')
var sign = require('./crypto/sign')
var stringify = require('json-stable-stringify')

module.exports = function (initialize, reduction, handler, withIndexedDB) {
  initialize(function () {
    return {
      identity: null,
      marks: null,
      draft: null
    }
  })

  // Identity

  handler('identity name', function (newName, state, reduce, done) {
    updateIdentity('name', newName, state, reduce, done)
  })

  handler('identity device', function (newDevice, state, reduce, done) {
    updateIdentity('device', newDevice, state, reduce, done)
  })

  reduction('identity', function (newIdentity, state) {
    return {identity: newIdentity}
  })

  function updateIdentity (key, value, state, reduce, done) {
    var changes = {}
    changes[key] = value
    var newIdentity = Object.assign({}, state.identity, changes)
    put('identities', newIdentity.publicKey, newIdentity, function (error) {
      if (error) return done(error)
      reduce('identity', newIdentity)
      done()
    })
  }

  // Loading

  handler('load marks', function (_, state, reduce, done) {
    withIndexedDB(function (error, db) {
      if (error) return done(error)
      var transaction = db.transaction(['marks'], 'readonly')
      transaction.onerror = function () {
        done(transaction.error)
      }
      var objectStore = transaction.objectStore('marks')
      var index = objectStore.index('public')
      var request = index.openCursor(state.identity.publicKey)
      var marks = []
      request.onsuccess = function () {
        var cursor = request.result
        if (cursor) {
          var value = cursor.value
          value.digest = cursor.primaryKey
          marks.push(value)
          cursor.continue()
        } else {
          reduce('marks', marks)
          done()
        }
      }
    })
  })

  reduction('marks', function (newMarks, state) {
    return {marks: newMarks}
  })

  handler('load draft', function (digest, state, reduce, done) {
    get('drafts', digest, function (error, result) {
      if (error) return done(error)
      if (result === undefined) {
        // TODO
      } else {
        result.digest = digest
        reduce('draft', result)
      }
      done()
    })
  })

  reduction('draft', function (newDraft, state) {
    return {draft: newDraft}
  })

  handler('load mark', function (digest, state, reduce, done) {
    get('marks', digest, function (error, mark) {
      if (error) return done(error)
      // TODO: Handle mark not found.
      window.history.pushState({}, null, '/drafts/' + mark.payload.draft)
      done()
    })
  })

  // Drafts

  handler('save', function (data, state, reduce, done) {
    var identity = state.identity
    var draft = {
      parents: data.parents,
      text: data.text,
      timestamp: new Date().toISOString()
    }
    var stringified = stringify(draft)
    var envelope = {
      payload: draft,
      public: identity.publicKey,
      signature: sign(stringified, identity.secretKey)
    }
    var digest = hash(stringified)
    put('drafts', digest, envelope, function (error) {
      if (error) return done(error)
      if (data.mark) {
        var mark = data.mark
        putMark(mark, digest, identity, function (error) {
          if (error) return done(error)
          window.history.pushState({}, null, '/mark/' + mark)
          done()
        })
      } else {
        window.history.pushState({}, null, '/drafts/' + digest)
        done()
      }
    })
  })

  // Marks

  handler('mark', function (name, state, reduce, done) {
    putMark(name, state.draft.digest, state.identity, done)
  })

  function putMark (name, draft, identity, callback) {
    var mark = {
      name: name,
      timestamp: new Date().toISOString(),
      draft: draft
    }
    var stringified = stringify(mark)
    var envelope = {
      payload: mark,
      public: identity.publicKey,
      signature: sign(stringified, identity.secretKey)
    }
    var digest = hash(stringified)
    put('marks', digest, envelope, callback)
  }

  // IndexedDB Helper

  function put (store, key, value, callback) {
    withIndexedDB(function (error, db) {
      if (error) return callback(error)
      var transaction = db.transaction([store], 'readwrite')
      transaction.oncomplete = function () {
        callback()
      }
      transaction.onerror = function () {
        callback(transaction.error)
      }
      var objectStore = transaction.objectStore(store)
      objectStore.put(value, key)
    })
  }

  function get (store, key, callback) {
    withIndexedDB(function (error, db) {
      if (error) return callback(error)
      var transaction = db.transaction([store], 'readonly')
      transaction.onerror = function () {
        callback(transaction.error)
      }
      var objectStore = transaction.objectStore(store)
      var request = objectStore.get(key)
      request.onsuccess = function () {
        callback(null, request.result)
      }
    })
  }
}
