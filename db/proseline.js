const Database = require('./database')
const assert = require('nanoassert')
const crypto = require('@proseline/crypto')
const has = require('has')
const inherits = require('inherits')
const pageBus = require('../page-bus')

// Proseline wraps a single IndexedDB database that stores
// client-global data, including data about other IndexedDB
// databases storing project data.
module.exports = Proseline

function Proseline () {
  this._projectStreams = []
  Database.call(this, {
    name: 'proseline',
    version: 2
  })
}

inherits(Proseline, Database)

const prototype = Proseline.prototype

prototype._upgrade = (db, oldVersion, callback) => {
  if (oldVersion < 1) {
    // The `projects` database holds information on projects the
    // user is working on.
    db.createObjectStore('projects')
  }
  if (oldVersion < 3) {
    // The `client` database holds the user's keypair for interacting
    // with paid.proseline.com.
    db.createObjectStore('client')
  }
  callback()
}

// Projects

prototype.putProject = function (project, callback) {
  assert(typeof project === 'object')
  assert(has(project, 'discoveryKey'))
  assert(has(project, 'encryptionKey'))
  const self = this
  const discoveryKey = project.discoveryKey
  self._put('projects', discoveryKey, project, error => {
    if (error) return callback(error)
    pageBus.emit('added project', discoveryKey)
    callback()
  })
}

prototype.overwriteProject = function (project, callback) {
  assert(typeof project === 'object')
  assert(has(project, 'discoveryKey'))
  assert(has(project, 'encryptionKey'))
  const self = this
  const discoveryKey = project.discoveryKey
  self._put('projects', discoveryKey, project, error => {
    if (error) return callback(error)
    pageBus.emit('overwrote project', discoveryKey)
    callback()
  })
}

prototype.getProject = function (discoveryKey, callback) {
  this._get('projects', discoveryKey, callback)
}

prototype.deleteProject = function (discoveryKey, callback) {
  const self = this
  self._delete('projects', discoveryKey, error => {
    if (error) return callback(error)
    pageBus.emit('deleted project', discoveryKey)
    callback()
  })
}

prototype.listProjects = function (callback) {
  this._listValues('projects', callback)
}

// User

// Get the user keypair for signing messages to paid.proseline.com.
// If the keypair doesn't exist yet, create it.
prototype.getClientKeyPair = function (callback) {
  const self = this
  self._get('client', 'keypair', (error, clientKeyPair) => {
    if (error) return callback(error)
    if (clientKeyPair !== undefined) {
      return callback(null, clientKeyPair)
    }
    clientKeyPair = crypto.signingKeyPair()
    self._put('client', 'keypair', clientKeyPair, error => {
      if (error) return callback(error)
      callback(null, clientKeyPair)
    })
  })
}

prototype.getSubscription = function (callback) {
  this._get('client', 'subscription', callback)
}

prototype.setSubscription = function (subscription, callback) {
  this._put('client', 'subscription', subscription, callback)
}

// Introduction

prototype.getIntro = function (callback) {
  this._get('client', 'intro', callback)
}

prototype.setIntro = function (intro, callback) {
  this._put('client', 'intro', intro, callback)
}
