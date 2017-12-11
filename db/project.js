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
    drafts.createIndex('parents', 'payload.parents', {
      unique: false,
      multiEntry: true
    })

    // Notes
    var notes = db.createObjectStore('notes')
    notes.createIndex('draft', 'payload.draft', {unique: false})
    notes.createIndex('parent', 'payload.parent', {
      unique: false,
      multiEntry: true
    })
    notes.createIndex('publicKey', 'publicKey', {unique: false})

    // Marks
    var marks = db.createObjectStore('marks')
    marks.createIndex('publicKey', 'publicKey', {unique: false})
    marks.createIndex('draft', 'payload.draft', {unique: false})
    marks.createIndex('identifier', 'payload.identifier', {unique: false})

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
