var Database = require('./database')
var createIdentity = require('../crypto/create-identity')
var inherits = require('inherits')

// TODO: paid peer data storage
var pageBus = require('../page-bus')

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

var prototype = Proseline.prototype

prototype._upgrade = function (db, oldVersion, callback) {
  if (oldVersion < 1) {
    // The `projects` database holds information on projects the
    // user is working on.
    db.createObjectStore('projects')
  }
  if (oldVersion < 2) {
    // The `user` database holds the user's keypair for interacting
    // with paid.proseline.com.
    db.createObjectStore('user')
  }
  callback()
}

// Projects

prototype.putProject = function (project, callback) {
  var self = this
  self._put('projects', project.discoveryKey, project, function (error) {
    if (error) return callback(error)
    pageBus.emit('added project', project.discoveryKey)
    callback()
  })
}

prototype.overwriteProject = function (project, callback) {
  var self = this
  self._put('projects', project.discoveryKey, project, function (error) {
    if (error) return callback(error)
    pageBus.emit('overwrote project', project.discoverKey)
    callback()
  })
}

prototype.getProject = function (discoveryKey, callback) {
  this._get('projects', discoveryKey, callback)
}

prototype.deleteProject = function (discoveryKey, callback) {
  var self = this
  self._delete('projects', discoveryKey, function (error) {
    if (error) return callback(error)
    pageBus.emit('deleted project', discoveryKey)
    callback()
  })
}

prototype.listProjects = function (callback) {
  this._listValues('projects', function (error, projects) {
    if (error) return callback(error)
    callback(null, projects.filter(function (project) {
      return !project.deleted
    }))
  })
}

// User

// Get the user keypair for signing messages to paid.proseline.com.
// If the keypair doesn't exist yet, create it.
prototype.getUserIdentity = function (callback) {
  var self = this
  self._get('user', 'identity', function (error, identity) {
    if (error) return callback(error)
    if (identity !== undefined) {
      return callback(null, identity)
    }
    identity = createIdentity()
    self._put('user', 'identity', identity, function (error) {
      if (error) return callback(error)
      callback(null, identity)
    })
  })
}

prototype.getSubscription = function (callback) {
  this._get('user', 'subscription', callback)
}

prototype.setSubscription = function (subscription, callback) {
  this._put('user', 'subscription', subscription, callback)
}
