var Database = require('./database')
var createIdentity = require('../crypto/create-identity')
var inherits = require('inherits')

module.exports = Project

function Project (secretKey) {
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
    drafts.createIndex('parents', 'entry.payload.parents', {
      unique: false,
      multiEntry: true
    })

    // Notes
    var notes = db.createObjectStore('notes')
    notes.createIndex('draft', 'entry.payload.draft', {unique: false})
    notes.createIndex('parent', 'entry.payload.parent', {
      unique: false,
      multiEntry: true
    })
    notes.createIndex('publicKey', 'publicKey', {unique: false})

    // Marks
    var marks = db.createObjectStore('marks')
    marks.createIndex('publicKey', 'publicKey', {unique: false})
    marks.createIndex('draft', 'entry.payload.draft', {unique: false})
    marks.createIndex('identifier', 'entry.payload.identifier', {unique: false})

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

// Logs

Project.prototype.getLogHead = function (publicKey, callback) {
  this._countFromIndex(
    'logs', 'publicKey',
    logEntryKey(publicKey, MIN_INDEX),
    logEntryKey(publicKey, MAX_INDEX),
    callback
  )
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

Project.prototype._log = function (key, envelope, callback) {
  var self = this
  var entryKey = logEntryKey(envelope.publicKey, envelope.entry.index)
  self._put('logs', entryKey, envelope, function (error) {
    if (error) return callback(error)
    var store = envelope.entry.payload.type + 's'
    self._put(store, key, envelope, callback)
  })
}

// Drafts

Project.prototype.putDraft = function (digest, envelope, callback) {
  this._log(digest, envelope, callback)
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
    var payload = value.entry.payload
    return {
      digest: cursor.key,
      publicKey: value.publicKey,
      parents: payload.parents,
      timestamp: payload.timestamp
    }
  }, callback)
}

// Marks

Project.prototype.putMark = function (publicKey, identifier, envelope, callback) {
  this._log(markKey(publicKey, identifier), envelope, callback)
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

Project.prototype.putNote = function (digest, envelope, callback) {
  this._log(digest, envelope, callback)
}
