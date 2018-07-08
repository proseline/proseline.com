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
  transportStream
    .on('end', function () {
      self.emit('done')
    })
    .on('error', function (error) {
      console.error(error)
      self.emit('done')
    })

  // Multiplex replication streams over the transport stream.
  var plex = self.plex = multiplex()
  self._sharedStreams = new Map()
  plex.on('stream', function (sharedStream, discoveryKey) {
    var proselineDatabase = databases.cache.proseline
    proselineDatabase.getProject(discoveryKey, function (error, project) {
      if (error) {
        debug('unknown discovery key: %o', discoveryKey)
        return sharedStream.destroy()
      }
      databases.get(discoveryKey, function (error, database) {
        if (error) return console.error(error)
        self.joinProject(project, database, sharedStream)
      })
    })
  })
  plex.pipe(transportStream).pipe(plex)

  // Add and remove replication streams as we join and leave projects.
  databases.scache.proseline
    .on('added project', function (project) {
      var discoveryKey = project.discoveryKey
      databases.get(discoveryKey, function (error, database) {
        if (error) return console.error(error)
        self.joinProject(project, database)
      })
    })
    .on('deleted project', function (discoveryKey) {
      self.leaveProject(discoveryKey)
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
  self._sharedStreams.set(discoveryKey, sharedStream)
  replicationStream
    .pipe(sharedStream)
    .pipe(replicationStream)
}

Peer.prototype.leaveProject = function (discoveryKey) {
  var self = this
  var sharedStreams = self._sharedStreams
  var sharedStream = sharedStreams.get(discoveryKey)
  if (sharedStream) {
    sharedStream.destroy()
    sharedStreams.delete(discoveryKey)
  }
  if (self.sharedStreams.size === 0) {
    self.emit('done')
    self.transportStream.destroy()
  }
}
