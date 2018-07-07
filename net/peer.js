var EventEmitter = require('events').EventEmitter
var databases = require('../db/databases')
var debug = require('debug')('proseline:peer')
var inherits = require('inherits')
var multiplex = require('multiplex')
var replicate = require('./replicate')
var runParallel = require('run-parallel')

module.exports = Peer

function Peer (id, transportStream) {
  if (!(this instanceof Peer)) return new Peer(id)
  var self = this
  self.id = id
  self.transportStream = transportStream
  var plex = self.plex = multiplex()
  plex.on('stream', function (sharedStream, discoveryKey) {
    var proselineDatabase = databases.cache.proseline
    proselineDatabase.getProject(discoveryKey, function (error, project) {
      if (error) {
        debug('unknown discovery key: %o', discoveryKey)
        return sharedStream.destroy()
      }
      databases.get(discoveryKey, function (error, database) {
        if (error) return console.error(error)
        self.join(project, database, sharedStream)
      })
    })
  })
}

inherits(Peer, EventEmitter)

Peer.prototype.joinProjects = function () {
  var self = this
  var proselineDB = databases.cache.proseline
  proselineDB.listProjects(function (error, projects) {
    if (error) return console.error(error)
    runParallel(projects.map(function (project) {
      return function (done) {
        databases.get(project.discoveryKey, function (error, database) {
          if (error) return console.error(error)
          self.joinProject(project, database)
          done()
        })
      }
    }))
  })
}

Peer.prototype.joinProject = function (
  project,
  database,
  sharedStream // optional
) {
  var self = this
  var discoveryKey = project.discoveryKey
  var replicationStream = replicate({
    secretKey: project.secretKey,
    discoveryKey,
    database,
    onUpdate: function (discoveryKey) {
      self.emit('update', discoveryKey)
    }
  })
  if (!sharedStream) {
    sharedStream = this.plex.createSharedStream(discoveryKey)
  }
  replicationStream
    .pipe(sharedStream)
    .pipe(replicationStream)
}
