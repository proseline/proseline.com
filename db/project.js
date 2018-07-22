var Database = require('./database')
var IDBKeyRange = require('./idbkeyrange')
var assert = require('assert')
var createIdentity = require('../crypto/create-identity')
var hash = require('../crypto/hash')
var inherits = require('inherits')
var multistream = require('multistream')
var runParallel = require('run-parallel')
var sign = require('../crypto/sign')
var stringify = require('../utilities/stringify')
var through2 = require('through2')

module.exports = Project

// Project wraps IndexedDB databases storing project data.
function Project (data) {
  assert.equal(typeof data, 'object')
  assert.equal(typeof data.discoveryKey, 'string')
  assert.equal(typeof data.writeKeyPair, 'object')
  this._updateStreams = []
  this._writeKeyPair = data.writeKeyPair
  Database.call(this, {
    name: data.discoveryKey,
    version: CURRENT_VERSION
  })
}

inherits(Project, Database)

var CURRENT_VERSION = 3

Project.prototype._upgrade = function (db, oldVersion, callback) {
  if (oldVersion < CURRENT_VERSION) {
    // Identities
    var identities = db.createObjectStore('identities')
    identities.createIndex('publicKey', 'publicKey', {unique: true})

    // Logs
    var logs = db.createObjectStore('logs')
    logs.createIndex('publicKey', 'publicKey', {unique: false})
    var TYPE_KEY_PATH = 'message.body.type'
    logs.createIndex('type', TYPE_KEY_PATH, {unique: false})
    logs.createIndex(
      'publicKey-type', ['publicKey', TYPE_KEY_PATH], {unique: false}
    )
    // Index by parents so we can query for drafts by parent digest.
    logs.createIndex('parents', 'message.body.parents', {
      unique: false,
      multiEntry: true
    })
    // Index by type and draft so we can query for marks and notes by
    // draft digest.
    logs.createIndex(
      'type-draft',
      [TYPE_KEY_PATH, 'message.body.draft'],
      {unique: false}
    )
    // Index by public key and identifier so we can query for marks.
    logs.createIndex(
      'publicKey-identifier',
      ['publicKey', 'message.body.identifier'],
      {unique: false}
    )
    // Index everything by digest, a property added just for indexing,
    // so that we can get drafts and notes by digest.
    logs.createIndex('digest', 'digest', {unique: true})
    // Index everything by time added so we can query for the most
    // recent activity in a project.
    logs.createIndex('added', 'added')
  }

  callback()
}

// Identities

Project.prototype.createIdentity = function (setDefault, callback) {
  var self = this
  var identity = createIdentity()
  self._put('identities', identity.publicKey, identity, function (error) {
    if (error) return callback(error)
    if (setDefault) {
      self._put('identities', 'default', identity.publicKey, function (error) {
        if (error) return callback(error)
        callback(null, identity)
      })
    } else {
      callback(null, identity)
    }
  })
}

Project.prototype.getIdentity = function (publicKey, callback) {
  this._get('identities', publicKey, callback)
}

Project.prototype.getDefaultIdentity = function (callback) {
  var self = this
  self.getIdentity('default', function (error, publicKey) {
    if (error) return callback(error)
    if (publicKey === undefined) {
      callback()
    } else {
      self.getIdentity(publicKey, callback)
    }
  })
}

// Intros

Project.prototype.listIntros = function (callback) {
  this._indexQuery('logs', 'type', 'intro', callback)
}

Project.prototype.putIntro = function (message, identity, callback) {
  assert.equal(typeof message, 'object')
  assert.equal(typeof identity, 'object')
  assert.equal(typeof callback, 'function')
  this._log(message, identity, callback)
}

// Logs

Project.prototype.getLogHead = function (publicKey, callback) {
  this._count(
    'logs',
    logEntryKey(publicKey, MIN_INDEX),
    logEntryKey(publicKey, MAX_INDEX),
    function (error, count) {
      if (error) return callback(error)
      if (count === 0) return callback(null, undefined)
      return callback(null, count - 1)
    }
  )
}

Project.prototype.listLogs = function (callback) {
  this._listIndexedValues('logs', 'publicKey', callback)
}

var MIN_INDEX = 0
var INDEX_DIGITS = 5
var MAX_INDEX = Number('9'.repeat(INDEX_DIGITS))

function logEntryKey (publicKey, index) {
  return publicKey + ':' + formatEntryIndex(index)
}

function formatEntryIndex (index) {
  return index.toString().padStart(INDEX_DIGITS, '0')
}

Project.prototype._log = function (message, identity, callback) {
  assert.equal(typeof message, 'object')
  assert(message.hasOwnProperty('project'))
  assert(message.hasOwnProperty('body'))
  assert.equal(typeof callback, 'function')
  var self = this
  var publicKey = identity.publicKey
  // Determine the current log head, create an envelope, and append
  // it in a single transaction.
  var envelope
  var transaction = self._db.transaction(['logs'], 'readwrite')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  transaction.oncomplete = function () {
    self._streamUpdate(
      envelope.publicKey, envelope.message.index,
      function (error) {
        if (error) return callback(error)
        callback(null, envelope, envelope.digest)
      }
    )
  }
  requestHead(transaction, publicKey, function (head) {
    if (head === undefined) {
      // This will be the first entry in the log.
      message.index = 0
    } else {
      // This will be a later entry in the log.
      message.index = head.message.index + 1
      message.prior = head.digest
    }
    var stringified = stringify(message)
    envelope = {
      message: message,
      publicKey: identity.publicKey,
      signature: sign(stringified, identity.secretKey),
      authorization: sign(stringified, self._writeKeyPair.secretKey)
    }
    addIndexingMetadata(envelope)
    transaction
      .objectStore('logs')
      .add(envelope, logEntryKey(envelope.publicKey, message.index))
  })
}

Project.prototype.getEnvelope = function (publicKey, index, callback) {
  var key = logEntryKey(publicKey, index)
  this._get('logs', key, function (error, envelope) {
    if (error) return callback(error)
    removeIndexingMetadata(envelope)
    callback(null, envelope)
  })
}

function requestHead (transaction, publicKey, onResult) {
  assert.equal(typeof transaction, 'object')
  assert.equal(typeof publicKey, 'string')
  assert.equal(typeof onResult, 'function')
  var lower = logEntryKey(publicKey, MIN_INDEX)
  var upper = logEntryKey(publicKey, MAX_INDEX)
  var request = transaction
    .objectStore('logs')
    .openCursor(IDBKeyRange.bound(lower, upper), 'prev')
  request.onsuccess = function () {
    var cursor = request.result
    if (!cursor) return onResult(undefined)
    onResult(cursor.value)
  }
}

Project.prototype.putEnvelope = function (envelope, callback) {
  assert.equal(typeof envelope, 'object')
  assert(envelope.hasOwnProperty('message'))
  assert(envelope.hasOwnProperty('publicKey'))
  assert(envelope.hasOwnProperty('signature'))
  assert.equal(typeof callback, 'function')
  var self = this
  addIndexingMetadata(envelope)
  var transaction = self._db.transaction(['logs'], 'readwrite')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var calledBackWithError = false
  transaction.oncomplete = function () {
    if (calledBackWithError) return
    self._streamUpdate(
      envelope.publicKey, envelope.message.index, callback
    )
  }
  var key = logEntryKey(envelope.publicKey, envelope.message.index)
  requestHead(transaction, envelope.publicKey, function (head) {
    if (head) {
      if (envelope.message.index !== head.message.index + 1) {
        calledBackWithError = true
        return callback(new Error('incorrect index'))
      }
      if (envelope.message.prior !== head.digest) {
        calledBackWithError = true
        return callback(new Error('incorrect prior'))
      }
    }
    transaction
      .objectStore('logs')
      .add(envelope, key)
  })
}

function addIndexingMetadata (envelope) {
  envelope.digest = hash(stringify(envelope.message))
  envelope.added = new Date().toISOString()
}

function removeIndexingMetadata (envelope) {
  delete envelope.digest
  delete envelope.added
}

Project.prototype._streamUpdate = function (publicKey, index, callback) {
  runParallel(
    this._updateStreams.map(function (stream) {
      return function (done) {
        stream.write({publicKey, index}, done)
      }
    }),
    callback
  )
}

Project.prototype.createOfferStream = function () {
  var self = this
  return multistream.obj([
    function currentHeads () {
      var stream = through2.obj()
      self.listLogs(function (error, publicKeys) {
        if (error) return stream.destroy(error)
        runParallel(
          publicKeys.map(function (publicKey) {
            return function (done) {
              self.getLogHead(publicKey, function (error, index) {
                if (error) return done(error)
                stream.write({publicKey, index}, done)
              })
            }
          }),
          function (error) {
            if (error) stream.destroy(error)
            stream.end()
          }
        )
      })
      return stream
    },
    function updatedHeads () {
      var stream = through2.obj()
      self._updateStreams.push(stream)
      return stream
    }
  ])
}

// Drafts

Project.prototype.putDraft = function (message, identity, callback) {
  this._log(message, identity, callback)
}

Project.prototype.getDraft = function (digest, callback) {
  this._getFromIndex('logs', 'digest', digest, callback)
}

Project.prototype.getChildren = function (digest, callback) {
  this._indexQuery('logs', 'parents', digest, callback)
}

Project.prototype.listDraftBriefs = function (callback) {
  var self = this
  self._indexQuery('logs', 'type', 'draft', function (error, drafts) {
    if (error) return callback(error)
    runParallel(
      drafts.map(function (draft) {
        return function (done) {
          self.countNotes(draft.digest, function (error, notesCount) {
            if (error) return done(error)
            var body = draft.message.body
            done(null, {
              digest: draft.digest,
              project: draft.message.project,
              publicKey: draft.publicKey,
              parents: body.parents,
              timestamp: body.timestamp,
              notesCount
            })
          })
        }
      }),
      callback
    )
  })
}

// Marks

Project.prototype.putMark = function (message, identity, callback) {
  this._log(message, identity, callback)
}

Project.prototype.getMark = function (publicKey, identifier, callback) {
  var transaction = this._db.transaction(['logs'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('logs')
  var index = objectStore.index('publicKey-identifier')
  var request = index.openCursor([publicKey, identifier], 'prev')
  request.onsuccess = function () {
    var cursor = request.result
    callback(null, cursor ? cursor.value : undefined)
  }
}

Project.prototype.getMarks = function (digest, callback) {
  this._indexQuery('logs', 'type-draft', ['mark', digest], callback)
}

Project.prototype.listMarks = function (callback) {
  this._indexQuery('logs', 'type', 'mark', function (error, marks) {
    if (error) return callback(error)
    var seen = new Set()
    callback(null, marks
      .reverse()
      .filter(function (mark) {
        var identifier = mark.message.body.identifier
        if (seen.has(identifier)) {
          return false
        } else {
          seen.add(identifier)
          return true
        }
      })
    )
  })
}

// Notes

Project.prototype.getNotes = function (digest, callback) {
  this._indexQuery('logs', 'type-draft', ['note', digest], callback)
}

Project.prototype.countNotes = function (digest, callback) {
  this._indexCount('logs', 'type-draft', ['note', digest], callback)
}

Project.prototype.putNote = function (message, identity, callback) {
  this._log(message, identity, callback)
}

// Activity

Project.prototype.activity = function (count, callback) {
  assert(Number.isInteger(count))
  assert(count > 0)
  var transaction = this._db.transaction(['logs'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('logs')
  var index = objectStore.index('added')
  var request = index.openCursor(null, 'prev') // reverse
  var results = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      results.push(cursor.value)
      if (results.length === count) {
        callback(null, results)
      } else {
        cursor.continue()
      }
    } else {
      callback(null, results)
    }
  }
}

Project.prototype.memberActivity = function (publicKey, count, callback) {
  assert.equal(typeof publicKey, 'string')
  assert.equal(publicKey.length, 64)
  assert(Number.isInteger(count))
  assert(count > 0)
  var transaction = this._db.transaction(['logs'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('logs')
  var index = objectStore.index('publicKey')
  var request = index.openCursor(publicKey, 'prev') // reverse
  var results = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      results.push(cursor.value)
      if (results.length === count) {
        callback(null, results)
      } else {
        cursor.continue()
      }
    } else {
      callback(null, results)
    }
  }
}

Project.prototype.markHistory = function (publicKey, identifier, count, callback) {
  assert.equal(typeof publicKey, 'string')
  assert.equal(publicKey.length, 64)
  assert(Number.isInteger(count))
  assert.equal(typeof identifier, 'string')
  assert.equal(identifier.length, 8)
  assert(count > 0)
  var transaction = this._db.transaction(['logs'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('logs')
  var index = objectStore.index('publicKey-identifier')
  var request = index.openCursor([publicKey, identifier], 'prev')
  var results = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      results.push(cursor.value)
      if (results.length === count) {
        callback(null, results)
      } else {
        cursor.continue()
      }
    } else {
      callback(null, results)
    }
  }
}
