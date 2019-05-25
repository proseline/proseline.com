var Database = require('./database')
var IDBKeyRange = require('./idbkeyrange')
var assert = require('assert')
var createIdentity = require('../crypto/create-identity')
var crypto = require('@proseline/crypto')
var debug = require('debug')
var hash = require('../crypto/hash')
var inherits = require('inherits')
var pageBus = require('../page-bus')
var runParallel = require('run-parallel')
var stringify = require('../utilities/stringify')

module.exports = Project

// Project wraps IndexedDB databases storing project data.
function Project (data) {
  assert.strictEqual(typeof data, 'object')
  assert.strictEqual(typeof data.projectDiscoveryKey, 'string')
  assert.strictEqual(typeof data.projectReadKey, 'string')
  assert.strictEqual(typeof data.projectWriteKeyPair, 'object')
  var projectDiscoveryKey = data.projectDiscoveryKey
  this.projectReadKey = data.projectReadKey
  this.projectWriteKeyPair = data.projectWriteKeyPair
  Database.call(this, {
    name: projectDiscoveryKey,
    version: CURRENT_VERSION
  })
  this.debug = debug('proseline:db:' + projectDiscoveryKey)
}

inherits(Project, Database)

var CURRENT_VERSION = 4

Project.prototype._upgrade = function (db, oldVersion, callback) {
  if (oldVersion < CURRENT_VERSION) {
    // Identities
    var identities = db.createObjectStore('identities')
    identities.createIndex('publicKey', 'publicKey', { unique: true })

    // Logs
    var logs = db.createObjectStore('logs')
    logs.createIndex('publicKey', 'publicKey', { unique: false })
    var TYPE_KEY_PATH = 'innerEnvelope.message.body.type'
    logs.createIndex('type', TYPE_KEY_PATH, { unique: false })
    logs.createIndex(
      'publicKey-type', ['publicKey', TYPE_KEY_PATH], { unique: false }
    )
    // Index by parents so we can query for drafts by parent digest.
    logs.createIndex('parents', 'innerEnvelope.message.body.parents', {
      unique: false,
      multiEntry: true
    })
    // Index by type and draft so we can query for marks and notes by
    // draft digest.
    logs.createIndex(
      'type-draft',
      [TYPE_KEY_PATH, 'innerEnvelope.message.body.draft'],
      { unique: false }
    )
    // Index by public key and identifier so we can query for marks.
    logs.createIndex(
      'publicKey-identifier',
      ['publicKey', 'innerEnvelope.message.body.identifier'],
      { unique: false }
    )
    // Index everything by digest, a property added just for indexing,
    // so that we can get drafts and notes by digest.
    logs.createIndex('digest', 'digest', { unique: true })
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
  assert.strictEqual(typeof message, 'object')
  assert.strictEqual(typeof identity, 'object')
  assert.strictEqual(typeof callback, 'function')
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
  assert.strictEqual(typeof message, 'object')
  assert(message.hasOwnProperty('project'))
  assert(message.hasOwnProperty('body'))
  assert.strictEqual(typeof callback, 'function')
  var self = this
  var publicKey = identity.publicKey
  // Determine the current log head, create an envelope, and append
  // it in a single transaction.
  var outerEnvelope = {
    publicKey: identity.publicKey,
    local: true
  }
  var innerEnvelope = {}
  var transaction = self._db.transaction(['logs'], 'readwrite')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  transaction.oncomplete = function () {
    self._emitOuterEnvelopeEvent(outerEnvelope)
    callback(null, outerEnvelope, outerEnvelope.digest)
  }
  requestHead(transaction, publicKey, function (head) {
    if (head === undefined) {
      // This will be the first entry in the log.
      outerEnvelope.index = 0
    } else {
      // This will be a later entry in the log.
      outerEnvelope.index = head.message.index + 1
      innerEnvelope.prior = head.digest
    }
    // Sign the inner envelope.
    innerEnvelope.message = message
    crypto.sign(innerEnvelope, identity, 'logSignature')
    crypto.sign(innerEnvelope, self.projectWriteKeyPair, 'projectSignature')
    // Encrypt the inner envelope.
    var stringifiedInnerEnvelope = stringify(innerEnvelope)
    var encryptionNonce = crypto.randomNonce()
    var encryptedInnerEnvelope = crypto.encrypt(
      Buffer.from(stringifiedInnerEnvelope),
      encryptionNonce,
      self.projectReadKey
    )
    outerEnvelope.encryptedInnerEnvelope = encryptedInnerEnvelope
    addIndexingMetadata(outerEnvelope, self.projectReadKey)
    transaction
      .objectStore('logs')
      .add(outerEnvelope, logEntryKey(outerEnvelope.publicKey, message.index))
  })
}

Project.prototype._emitOuterEnvelopeEvent = function (outerEnvelope) {
  pageBus.emit('outerEnvelope', outerEnvelope)
}

Project.prototype.getOuterEnvelope = function (publicKey, index, callback) {
  var key = logEntryKey(publicKey, index)
  this._get('logs', key, function (error, outerEnvelope) {
    if (error) return callback(error)
    removeIndexingMetadata(outerEnvelope)
    callback(null, outerEnvelope)
  })
}

function requestHead (transaction, publicKey, onResult) {
  assert.strictEqual(typeof transaction, 'object')
  assert.strictEqual(typeof publicKey, 'string')
  assert.strictEqual(typeof onResult, 'function')
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

Project.prototype.putOuterEnvelope = function (outerEnvelope, callback) {
  assert.strictEqual(typeof outerEnvelope, 'object')
  assert(outerEnvelope.hasOwnProperty('encryptedInnerEnvelope'))
  assert(outerEnvelope.hasOwnProperty('index'))
  assert(outerEnvelope.hasOwnProperty('nonce'))
  assert(outerEnvelope.hasOwnProperty('project'))
  assert(outerEnvelope.hasOwnProperty('publicKey'))
  assert.strictEqual(typeof callback, 'function')
  var self = this
  var debug = self.debug
  addIndexingMetadata(outerEnvelope, self.projectReadKey)
  var transaction = self._db.transaction(['logs'], 'readwrite')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var calledBackWithError = false
  transaction.oncomplete = function () {
    if (calledBackWithError) return
    self._emitOuterEnvelopeEvent(outerEnvelope)
    callback()
  }
  var index = outerEnvelope.message.index
  var prior = outerEnvelope.message.prior
  var publicKey = outerEnvelope.publicKey
  requestHead(transaction, publicKey, function (head) {
    if (head) {
      if (index !== head.message.index + 1) {
        calledBackWithError = true
        debug('incorrect index new %d have %d', index, head.message.index)
        return callback(new Error('incorrect index'))
      }
      if (prior !== head.digest) {
        calledBackWithError = true
        debug('incorrect index head %s new %s', head.digest, prior)
        return callback(new Error('incorrect prior'))
      }
    }
    var key = logEntryKey(publicKey, index)
    transaction
      .objectStore('logs')
      .add(outerEnvelope, key)
  })
}

function addIndexingMetadata (outerEnvelope, projectReadKey) {
  var encryptedInnerEnvelope = outerEnvelope.encryptedInnerEnvelope
  var nonce = outerEnvelope.nonce
  var innerEnvelopeJSON = crypto.decrypt(
    encryptedInnerEnvelope, nonce, projectReadKey
  )
  if (!innerEnvelopeJSON) {
    throw new Error('Failed to decrypt encryptedInnerEnvelope.')
  }
  try {
    var innerEnvelope = JSON.parse(innerEnvelopeJSON)
  } catch (error) {
    throw new Error('Failed to parse encryptedInnerEnvelope.')
  }
  var message = innerEnvelope.message
  outerEnvelope.innerEnvelope = innerEnvelope
  outerEnvelope.digest = hash(stringify(message))
  outerEnvelope.added = new Date().toISOString()
}

function removeIndexingMetadata (outerEnvelope) {
  delete outerEnvelope.innerEnvelope
  delete outerEnvelope.digest
  delete outerEnvelope.added
  delete outerEnvelope.local
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
  assert.strictEqual(typeof publicKey, 'string')
  assert.strictEqual(publicKey.length, 64)
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
  assert.strictEqual(typeof publicKey, 'string')
  assert.strictEqual(publicKey.length, 64)
  assert(Number.isInteger(count))
  assert.strictEqual(typeof identifier, 'string')
  assert.strictEqual(identifier.length, 8)
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
