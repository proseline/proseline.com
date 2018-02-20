var Database = require('./database')
var IDBKeyRange = require('./idbkeyrange')
var assert = require('assert')
var createIdentity = require('../crypto/create-identity')
var hash = require('../crypto/hash')
var inherits = require('inherits')
var runParallel = require('run-parallel')
var sign = require('../crypto/sign')
var stringify = require('../utilities/stringify')
var through2 = require('through2')

module.exports = Project

function Project (secretKey) {
  this._updateStreams = []
  Database.call(this, {
    name: secretKey,
    version: 1
  })
}

inherits(Project, Database)

Project.prototype._upgrade = function (db, oldVersion, callback) {
  if (oldVersion < 1) {
    // Identities
    var identities = db.createObjectStore('identities')
    identities.createIndex('publicKey', 'publicKey', {unique: true})

    // Intros
    var intros = db.createObjectStore('intros')
    intros.createIndex('publicKey', 'publicKey', {unique: true})

    // Drafts
    var drafts = db.createObjectStore('drafts')
    drafts.createIndex('parents', 'message.body.parents', {
      unique: false,
      multiEntry: true
    })

    // Notes
    var notes = db.createObjectStore('notes')
    notes.createIndex('draft', 'message.body.draft', {unique: false})
    notes.createIndex('parent', 'message.body.parent', {
      unique: false,
      multiEntry: true
    })
    notes.createIndex('publicKey', 'publicKey', {unique: false})

    // Marks
    var marks = db.createObjectStore('marks')
    marks.createIndex('publicKey', 'publicKey', {unique: false})
    marks.createIndex('draft', 'message.body.draft', {unique: false})
    marks.createIndex('identifier', 'message.body.identifier', {unique: false})

    // Logs
    var logs = db.createObjectStore('logs')
    logs.createIndex('publicKey', 'publicKey', {unique: false})
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

Project.prototype.getIntro = function (publicKey, callback) {
  this._get('intros', publicKey, callback)
}

// Intros

Project.prototype.listIntros = function (callback) {
  this._listValues('intros', callback)
}

Project.prototype.putIntro = function (message, identity, callback) {
  assert.equal(typeof message, 'object')
  assert.equal(typeof identity, 'object')
  assert.equal(typeof callback, 'function')
  this._log(identity.publicKey, message, identity, callback)
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

var COMPUTE_DIGEST = {}

Project.prototype._log = function (key, message, identity, callback) {
  assert.equal(typeof message, 'object')
  assert(message.hasOwnProperty('project'))
  assert(message.hasOwnProperty('body'))
  assert.equal(typeof callback, 'function')
  var self = this
  var typeStore = message.body.type + 's'
  var publicKey = identity.publicKey
  // Determine the current log head, create an envelope, and append
  // it in a single transaction.
  var envelope
  var transaction = self._db.transaction(['logs', typeStore], 'readwrite')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  transaction.oncomplete = function () {
    // Write to update streams for replication.
    runParallel(
      self._updateStreams.map(function (stream) {
        return function (done) {
          stream.write({
            publicKey: envelope.publicKey,
            index: envelope.message.index
          }, done)
        }
      }),
      function (error) {
        if (error) return callback(error)
        callback(null, envelope, key)
      }
    )
  }
  // Find the head of the log by counting entries.
  var lower = logEntryKey(publicKey, MIN_INDEX)
  var upper = logEntryKey(publicKey, MAX_INDEX)
  var headRequest = transaction
    .objectStore('logs')
    .count(IDBKeyRange.bound(lower, upper))
  headRequest.onsuccess = function () {
    var index = headRequest.result
    message.index = index
    var stringified = stringify(message)
    // Put the message in a signed envelope.
    envelope = {
      message: message,
      publicKey: identity.publicKey,
      signature: sign(stringified, identity.secretKey)
    }
    // Put the envelope.
    transaction
      .objectStore('logs')
      .put(envelope, logEntryKey(envelope.publicKey, index))
    // Put to the type-specific store.
    if (key === COMPUTE_DIGEST) key = hash(stringified)
    transaction
      .objectStore(typeStore)
      .put(envelope, key)
  }
}

Project.prototype.getEnvelope = function (publicKey, index, callback) {
  this._get('logs', logEntryKey(publicKey, index), callback)
}

Project.prototype.createLogsStream = function () {
  var stream = through2.obj()
  var self = this
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
        stream.destroy(error)
      }
    )
  })
  return stream
}

Project.prototype.createUpdateStream = function () {
  var stream = through2.obj()
  this._updateStreams.push(stream)
  return stream
}

// Drafts

Project.prototype.putDraft = function (message, identity, callback) {
  this._log(COMPUTE_DIGEST, message, identity, callback)
}

Project.prototype.getDraft = function (digest, callback) {
  this._get('drafts', digest, callback)
}

Project.prototype.getChildren = function (digest, callback) {
  var transaction = this._db.transaction(['drafts'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('drafts')
  var index = objectStore.index('parents')
  var request = index.openCursor(digest)
  var children = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      var value = cursor.value
      value.digest = cursor.primaryKey
      children.push(value)
      cursor.continue()
    } else {
      callback(null, children)
    }
  }
}

Project.prototype.listDraftBriefs = function (callback) {
  this._list('drafts', function (cursor) {
    var value = cursor.value
    var body = value.message.body
    return {
      digest: cursor.key,
      publicKey: value.publicKey,
      parents: body.parents,
      timestamp: body.timestamp
    }
  }, callback)
}

// Marks

Project.prototype.putMark = function (message, identity, callback) {
  var publicKey = identity.publicKey
  var identifier = message.body.identifier
  var key = markKey(publicKey, identifier)
  this._log(key, message, identity, callback)
}

Project.prototype.getMark = function (publicKey, identifier, callback) {
  this._get('marks', markKey(publicKey, identifier), callback)
}

function markKey (publicKey, identifier) {
  return publicKey + ':' + identifier
}

// TODO: Use a method on Database
Project.prototype.getMarks = function (digest, callback) {
  var transaction = this._db.transaction(['marks'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('marks')
  var index = objectStore.index('draft')
  var request = index.openCursor(digest)
  var marks = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      var value = cursor.value
      marks.push(value)
      cursor.continue()
    } else {
      callback(null, marks)
    }
  }
}

Project.prototype.listMarks = function (callback) {
  this._listValues('marks', callback)
}

// Notes

Project.prototype.getNotes = function (digest, callback) {
  var transaction = this._db.transaction(['notes'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('notes')
  var index = objectStore.index('draft')
  var request = index.openCursor(digest)
  var notes = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      var value = cursor.value
      value.digest = cursor.primaryKey
      notes.push(value)
      cursor.continue()
    } else {
      callback(null, notes)
    }
  }
}

Project.prototype.putNote = function (message, identity, callback) {
  this._log(COMPUTE_DIGEST, message, identity, callback)
}
