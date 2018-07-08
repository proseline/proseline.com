var Database = require('./database')
var inherits = require('inherits')

// TODO: paid peer data storage

// Proselines wraps a single IndexedDB database that stores
// client-global data, including data about other IndexedDB
// databases storing project data.
module.exports = Proseline

function Proseline () {
  Database.call(this, {
    name: 'proseline',
    version: 1
  })
}

inherits(Proseline, Database)

var prototype = Proseline.prototype

prototype._upgrade = function (db, oldVersion, callback) {
  if (oldVersion < 1) {
    db.createObjectStore('projects')
  }

  callback()
}

prototype.putProject = function (project, callback) {
  var self = this
  self._put('projects', project.discoveryKey, project, function (error) {
    if (error) return callback(error)
    self.emit('added project', project)
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
    self.emit('deleted project', discoveryKey)
    callback()
  })
}

prototype.listProjects = function (callback) {
  this._listValues('projects', callback)
}
