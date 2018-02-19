var Database = require('./database')
var inherits = require('inherits')

// TODO: paid peer data storage

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
  this._put('projects', project.discoveryKey, project, callback)
}

prototype.getProject = function (discoveryKey, callback) {
  this._get('projects', discoveryKey, callback)
}

prototype.listProjects = function (callback) {
  this._listValues('projects', callback)
}
