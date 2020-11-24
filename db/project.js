const Database = require('./database')
const IDBKeyRange = require('./idbkeyrange')
const assert = require('nanoassert')
const crypto = require('@proseline/crypto')
const debug = require('debug')
const has = require('has')
const inherits = require('inherits')
const pageBus = require('../page-bus')
const runParallel = require('run-parallel')

module.exports = Project

// Project wraps IndexedDB databases storing project data.
function Project (data) {
  assert(typeof data === 'object')
  assert(typeof data.discoveryKey === 'string')
  assert(typeof data.encryptionKey === 'string')
  assert(typeof data.projectKeyPair === 'object')
  const discoveryKey = data.discoveryKey
  this.discoveryKey = discoveryKey
  this.encryptionKey = data.encryptionKey
  this.projectKeyPair = data.projectKeyPair
  Database.call(this, {
    name: discoveryKey,
    version: CURRENT_VERSION
  })
  this.debug = debug('proseline:db:' + discoveryKey)
}

inherits(Project, Database)

const CURRENT_VERSION = 4

Project.prototype._upgrade = function (db, oldVersion, callback) {
  if (oldVersion < CURRENT_VERSION) {
    // Log Key Pairs
    const logKeyPairs = db.createObjectStore('logKeyPairs')
    logKeyPairs.createIndex('logPublicKey', 'publicKey', { unique: true })

    // Logs
    const logs = db.createObjectStore('logs')
    logs.createIndex('logPublicKey', 'logPublicKey', { unique: false })
    const TYPE_KEY_PATH = 'type'
    logs.createIndex('type', TYPE_KEY_PATH, { unique: false })
    logs.createIndex(
      'logPublicKey-type', ['logPublicKey', TYPE_KEY_PATH], { unique: false }
    )
    // Index by parents so we can query for drafts by parent digest.
    logs.createIndex('parents', 'parents', {
      unique: false,
      multiEntry: true
    })
    // Index by type and draft so we can query for marks and notes by
    // draft digest.
    logs.createIndex(
      'type-draft',
      [TYPE_KEY_PATH, 'draft'],
      { unique: false }
    )
    // Index by public key and identifier so we can query for marks.
    logs.createIndex(
      'logPublicKey-identifier',
      ['logPublicKey', 'identifier'],
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

// Log Key Pairs

Project.prototype.createLogKeyPair = function (setDefault, callback) {
  const self = this
  const logKeyPair = crypto.keyPair()
  const logPublicKey = logKeyPair.publicKey
  self._put('logKeyPairs', logPublicKey, logKeyPair, function (error) {
    if (error) return callback(error)
    if (setDefault) {
      self._put('logKeyPairs', 'default', logPublicKey, function (error) {
        if (error) return callback(error)
        callback(null, logKeyPair)
      })
    } else {
      callback(null, logKeyPair)
    }
  })
}

Project.prototype.getLogKeyPair = function (logPublicKey, callback) {
  this._get('logKeyPairs', logPublicKey, callback)
}

Project.prototype.getDefaultLogKeyPair = function (callback) {
  const self = this
  self.getLogKeyPair('default', function (error, logPublicKey) {
    if (error) return callback(error)
    if (logPublicKey === undefined) {
      callback()
    } else {
      self.getLogKeyPair(logPublicKey, callback)
    }
  })
}

// Intros

Project.prototype.listIntros = function (callback) {
  this._indexQuery('logs', 'type', 'intro', callback)
}

Project.prototype.putIntro = function (entry, logKeyPair, callback) {
  assert(typeof entry === 'object')
  assert(typeof logKeyPair === 'object')
  assert(typeof callback === 'function')
  this._log(entry, logKeyPair, callback)
}

// Logs

Project.prototype.getLogHead = function (logPublicKey, callback) {
  this._count(
    'logs',
    logEntryKey(logPublicKey, MIN_INDEX),
    logEntryKey(logPublicKey, MAX_INDEX),
    function (error, count) {
      if (error) return callback(error)
      if (count === 0) return callback(null, undefined)
      return callback(null, count - 1)
    }
  )
}

Project.prototype.listLogs = function (callback) {
  this._listIndexedValues('logs', 'logPublicKey', callback)
}

const MIN_INDEX = 0
const INDEX_DIGITS = 5
const MAX_INDEX = Number('9'.repeat(INDEX_DIGITS))

function logEntryKey (logPublicKey, index) {
  return logPublicKey + ':' + formatEntryIndex(index)
}

function formatEntryIndex (index) {
  return index.toString().padStart(INDEX_DIGITS, '0')
}

Project.prototype._log = function (entry, logKeyPair, callback) {
  assert(typeof entry === 'object')
  assert(typeof logKeyPair === 'object')
  assert(typeof callback === 'function')
  const self = this
  const logPublicKey = logKeyPair.publicKey
  // Determine the current log head, create an envelope, and append
  // it in a single transaction.
  const transaction = self._db.transaction(['logs'], 'readwrite')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  transaction.oncomplete = function () {
    self._emitEntryEvent(entry)
    callback(null, entry, entry.digest)
  }
  requestHead(transaction, logPublicKey, function (head) {
    let index, prior
    if (head === undefined) {
      // This will be the first entry in the log.
      index = 0
    } else {
      // This will be a later entry in the log.
      index = head.index + 1
      prior = head.digest
    }
    const envelope = crypto.envelope({
      discoveryKey: self.discoveryKey,
      entry,
      logKeyPair: logKeyPair,
      projectKeyPair: self.projectKeyPair,
      encryptionKey: self.encryptionKey,
      index,
      prior
    })
    entry.envelope = envelope
    entry.local = true
    addIndexingMetadata(entry, self.encryptionKey)
    transaction
      .objectStore('logs')
      .add(entry, logEntryKey(logPublicKey, entry.index))
  })
}

Project.prototype._emitEntryEvent = function (entry) {
  pageBus.emit('entry', entry)
}

Project.prototype.getEntry = function (logPublicKey, index, callback) {
  const key = logEntryKey(logPublicKey, index)
  this._get('logs', key, function (error, entry) {
    if (error) return callback(error)
    removeIndexingMetadata(entry)
    callback(null, entry)
  })
}

function requestHead (transaction, logPublicKey, onResult) {
  assert(typeof transaction === 'object')
  assert(typeof logPublicKey === 'string')
  assert(typeof onResult === 'function')
  const lower = logEntryKey(logPublicKey, MIN_INDEX)
  const upper = logEntryKey(logPublicKey, MAX_INDEX)
  const request = transaction
    .objectStore('logs')
    .openCursor(IDBKeyRange.bound(lower, upper), 'prev')
  request.onsuccess = function () {
    const cursor = request.result
    if (!cursor) return onResult(undefined)
    onResult(cursor.value)
  }
}

Project.prototype.putEnvelope = function (envelope, entry, callback) {
  assert(typeof envelope === 'object')
  assert(has(envelope, 'encryptedInnerEnvelope'))
  assert(has(envelope, 'index'))
  assert(has(envelope, 'nonce'))
  assert(has(envelope, 'discoveryKey'))
  assert(has(envelope, 'logPublicKey'))
  assert(typeof callback === 'function')
  const self = this
  const debug = self.debug
  const transaction = self._db.transaction(['logs'], 'readwrite')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  let calledBackWithError = false
  transaction.oncomplete = function () {
    if (calledBackWithError) return
    self._emitEntryEvent(entry)
    callback()
  }
  const index = envelope.index
  const logPublicKey = envelope.logPublicKey
  const prior = envelope.prior
  requestHead(transaction, logPublicKey, function (head) {
    if (head) {
      if (index !== head.index + 1) {
        calledBackWithError = true
        debug('incorrect index new %d have %d', index, head.index)
        return callback(new Error('incorrect index'))
      }
      if (prior !== head.digest) {
        calledBackWithError = true
        debug('incorrect index head %s new %s', head.digest, prior)
        return callback(new Error('incorrect prior'))
      }
    }
    addIndexingMetadata(entry)
    entry.envelope = envelope
    const key = logEntryKey(logPublicKey, index)
    transaction
      .objectStore('logs')
      .add(entry, key)
  })
}

function addIndexingMetadata (entry) {
  entry.digest = crypto.hashJSON(entry)
  entry.added = new Date().toISOString()
}

function removeIndexingMetadata (entry) {
  delete entry.digest
  delete entry.added
  delete entry.local
}

// Drafts

Project.prototype.putDraft = function (entry, logKeyPair, callback) {
  this._log(entry, logKeyPair, callback)
}

Project.prototype.getDraft = function (digest, callback) {
  this._getFromIndex('logs', 'digest', digest, callback)
}

Project.prototype.getChildren = function (digest, callback) {
  this._indexQuery('logs', 'parents', digest, callback)
}

Project.prototype.listDraftBriefs = function (callback) {
  const self = this
  self._indexQuery('logs', 'type', 'draft', function (error, drafts) {
    if (error) return callback(error)
    runParallel(
      drafts.map(function (draft) {
        return function (done) {
          self.countNotes(draft.digest, function (error, notesCount) {
            if (error) return done(error)
            const body = draft.entry
            done(null, {
              digest: draft.digest,
              discoveryKey: draft.discoveryKey,
              logPublicKey: draft.envelope.logPublicKey,
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

Project.prototype.putMark = function (entry, logKeyPair, callback) {
  this._log(entry, logKeyPair, callback)
}

Project.prototype.getMark = function (logPublicKey, identifier, callback) {
  const transaction = this._db.transaction(['logs'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore('logs')
  const index = objectStore.index('logPublicKey-identifier')
  const request = index.openCursor([logPublicKey, identifier], 'prev')
  request.onsuccess = function () {
    const cursor = request.result
    callback(null, cursor ? cursor.value : undefined)
  }
}

Project.prototype.getMarks = function (digest, callback) {
  this._indexQuery('logs', 'type-draft', ['mark', digest], callback)
}

Project.prototype.listMarks = function (callback) {
  this._indexQuery('logs', 'type', 'mark', function (error, marks) {
    if (error) return callback(error)
    const seen = new Set()
    callback(null, marks
      .reverse()
      .filter(function (mark) {
        const identifier = mark.identifier
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

Project.prototype.putNote = function (entry, logKeyPair, callback) {
  this._log(entry, logKeyPair, callback)
}

// Activity

Project.prototype.activity = function (count, callback) {
  assert(Number.isInteger(count))
  assert(count > 0)
  const transaction = this._db.transaction(['logs'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore('logs')
  const index = objectStore.index('added')
  const request = index.openCursor(null, 'prev') // reverse
  const results = []
  request.onsuccess = function () {
    const cursor = request.result
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

Project.prototype.memberActivity = function (logPublicKey, count, callback) {
  assert(typeof logPublicKey === 'string')
  assert(logPublicKey.length === 64)
  assert(Number.isInteger(count))
  assert(count > 0)
  const transaction = this._db.transaction(['logs'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore('logs')
  const index = objectStore.index('logPublicKey')
  const request = index.openCursor(logPublicKey, 'prev') // reverse
  const results = []
  request.onsuccess = function () {
    const cursor = request.result
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

Project.prototype.markHistory = function (logPublicKey, identifier, count, callback) {
  assert(typeof logPublicKey === 'string')
  assert(logPublicKey.length === 64)
  assert(Number.isInteger(count))
  assert(typeof identifier === 'string')
  assert(identifier.length === 8)
  assert(count > 0)
  const transaction = this._db.transaction(['logs'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  const objectStore = transaction.objectStore('logs')
  const index = objectStore.index('logPublicKey-identifier')
  const request = index.openCursor([logPublicKey, identifier], 'prev')
  const results = []
  request.onsuccess = function () {
    const cursor = request.result
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
