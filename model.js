var diff = require('diff')
var hash = require('./crypto/hash')
var random = require('./crypto/random')
var runParallel = require('run-parallel')
var sign = require('./crypto/sign')
var stringify = require('json-stable-stringify')

var getChildren = require('./queries/children')
var getMarks = require('./queries/marks')
var getNotes = require('./queries/notes')

module.exports = function (initialize, reduction, handler, withIndexedDB) {
  initialize(function () {
    return {
      identity: null,
      intro: null,
      marks: null,
      notes: null,
      replyTo: null,
      parent: null,
      draft: null,
      ownMarks: null
    }
  })

  // Intro

  handler('introduce', function (data, state, reduce, done) {
    var identity = state.identity
    var intro = {
      name: data.name,
      device: data.device,
      timestamp: new Date().toISOString()
    }
    var stringified = stringify(intro)
    var envelope = {
      payload: intro,
      public: identity.publicKey,
      signature: sign(stringified, identity.secretKey)
    }
    put('intros', identity.publicKey, envelope, function (error) {
      if (error) return done(error)
      reduce('intro', envelope)
      done()
    })
  })

  reduction('intro', function (newIntro, state) {
    return {intro: newIntro}
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

  handler('load own marks', function (_, state, reduce, done) {
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
          reduce('own marks', marks)
          done()
        }
      }
    })
  })

  reduction('own marks', function (newMarks, state) {
    return {ownMarks: newMarks}
  })

  handler('load draft', function (digest, state, reduce, done) {
    runParallel({
      draft: function (done) {
        getDraft(digest, done)
      },
      notes: function (done) {
        withIndexedDB(function (error, db) {
          if (error) return done(error)
          getNotes(db, digest, done)
        })
      },
      children: function (done) {
        withIndexedDB(function (error, db) {
          if (error) return done(error)
          getChildren(db, digest, done)
        })
      }
    }, function (error, results) {
      if (error) return done(error)
      results.draft.children = results.children
      results.draft.notes = results.notes.notes
      results.draft.noteIntros = results.notes.intros
      reduce('draft', results.draft)
      done()
    })
  })

  function getDraft (digest, callback) {
    get('drafts', digest, function (error, draft) {
      if (error) return callback(error)
      if (draft === undefined) return callback()
      draft.digest = digest
      withIndexedDB(function (error, db) {
        if (error) return callback(error)
        // TODO: Consolidate getting intros for marks and notes.
        runParallel({
          intro: function (done) {
            get('intros', draft.public, done)
          },
          marks: function (done) {
            getMarks(db, draft.digest, done)
          },
          notes: function (done) {
            getNotes(db, draft.digest, done)
          }
        }, function (error, results) {
          if (error) return callback(error)
          callback(null, {
            draft: draft,
            intro: results.intro,
            marks: results.marks.marks,
            markIntros: results.marks.markIntros
          })
        })
      })
    })
  }

  reduction('draft', function (data, state) {
    var children = data.children || []
    return {
      draft: data.draft,
      intro: data.intro || null,
      marks: data.marks || [],
      markIntros: data.markIntros || {},
      notes: data.notes || [],
      noteIntros: data.noteIntros || {},
      replyTo: null,
      children: children,
      diff: null,
      parent: null,
      ownMarks: null
    }
  })

  handler('diff', function (index, state, reduce, done) {
    reduce('diff', {
      index: index,
      changes: diff.diffLines(
        state.draft.payload.text,
        state.children[index].payload.text
      )
    })
    done()
  })

  handler('stop diffing', function (_, state, reduce, done) {
    reduce('diff', null)
    done()
  })

  reduction('diff', function (diff, state) {
    return {diff: diff}
  })

  handler('load parent', function (digest, state, reduce, done) {
    getDraft(digest, function (error, results) {
      if (error) return done(error)
      reduce('parent', results)
      done()
    })
  })

  reduction('parent', function (data, state) {
    return {
      parent: data.draft,
      intro: data.intro || null,
      marks: data.marks || [],
      markIntros: data.markIntros || {},
      ownMarks: null
    }
  })

  handler('load mark', function (key, state, reduce, done) {
    get('marks', key, function (error, mark) {
      if (error) return done(error)
      // TODO: Handle mark not found.
      window.history.replaceState({}, null, '/drafts/' + mark.payload.draft)
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
        putMark(
          null, mark, digest, identity,
          function (error, mark) {
            if (error) return done(error)
            window.history.pushState(
              {}, null,
              '/marks/' + identity.publicKey + ':' + mark.payload.identifier
            )
            done()
          }
        )
      } else {
        window.history.pushState({}, null, '/drafts/' + digest)
        done()
      }
    })
  })

  // Marks

  handler('mark', function (name, state, reduce, done) {
    putMark(
      null, name, state.draft.digest, state.identity,
      function (error, mark) {
        if (error) return done(error)
        reduce('push mark', mark)
        done()
      }
    )
  })

  reduction('push mark', function (mark, state) {
    return {marks: state.marks.concat(mark)}
  })

  function putMark (identifier, name, draft, identity, callback) {
    identifier = identifier || random(4)
    var mark = {
      identifier: identifier,
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
    var key = identity.publicKey + ':' + identifier
    put('marks', key, envelope, function (error) {
      if (error) return callback(error)
      callback(null, envelope)
    })
  }

  // Notes

  handler('note', function (data, state, reduce, done) {
    var identity = state.identity
    var note = {
      draft: state.draft.digest,
      parent: data.parent,
      text: data.text,
      timestamp: new Date().toISOString()
    }
    var stringified = stringify(note)
    var envelope = {
      payload: note,
      public: identity.publicKey,
      signature: sign(stringified, identity.secretKey)
    }
    var digest = hash(stringified)
    put('notes', digest, envelope, function (error) {
      if (error) return done(error)
      reduce('push note', envelope)
      done()
    })
  })

  reduction('push note', function (note, state) {
    // TODO: re-treeify notes
    return {notes: state.notes.concat(note)}
  })

  handler('reply to', function (parent, state, reduce, done) {
    reduce('reply to', parent)
    done()
  })

  reduction('reply to', function (parent, state) {
    return {replyTo: parent}
  })

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
