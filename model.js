var hash = require('./crypto/hash')
var runParallel = require('run-parallel')
var sign = require('./crypto/sign')
var stringify = require('json-stable-stringify')

var getLatestIntro = require('./queries/latest-introduction')
var getMarks = require('./queries/marks')

module.exports = function (initialize, reduction, handler, withIndexedDB) {
  initialize(function () {
    return {
      identity: null,
      introduction: null,
      marks: null,
      draft: null
    }
  })

  // Introduction

  handler('introduce', function (data, state, reduce, done) {
    var identity = state.identity
    var introduction = {
      name: data.name,
      device: data.device,
      timestamp: new Date().toISOString()
    }
    var stringified = stringify(introduction)
    var envelope = {
      payload: introduction,
      public: identity.publicKey,
      signature: sign(stringified, identity.secretKey)
    }
    var digest = hash(stringified)
    put('introductions', digest, envelope, function (error) {
      if (error) return done(error)
      reduce('introduction', envelope)
      done()
    })
  })

  reduction('introduction', function (newIntroduction, state) {
    return {introduction: newIntroduction}
  })

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
    get('drafts', digest, function (error, draft) {
      if (error) return done(error)
      if (draft === undefined) {
        // TODO
      } else {
        draft.digest = digest
        withIndexedDB(function (error, db) {
          if (error) return done(error)
          runParallel({
            intro: function (done) {
              getLatestIntro(db, draft.public, done)
            },
            marks: function (done) {
              getMarks(db, draft.digest, done)
            }
          }, function (error, results) {
            if (error) return done(error)
            reduce('draft', {
              draft: draft,
              introduction: results.intro,
              marks: results.marks.marks,
              markIntroductions: results.marks.markIntroductions
            })
            done()
          })
        })
      }
    })
  })

  reduction('draft', function (data, state) {
    return {
      draft: data.draft,
      introduction: data.introduction || null,
      marks: data.marks || [],
      markIntroductions: data.markIntroductions || {}
    }
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
