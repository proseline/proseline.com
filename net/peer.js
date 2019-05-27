var EventEmitter = require('events').EventEmitter
var databases = require('../db/databases')
var debug = require('debug')
var duplexify = require('duplexify')
var inherits = require('inherits')
var multiplex = require('multiplex')
var pageBus = require('../page-bus')
var replicate = require('./replicate')

var DEBUG_NAMESPACE = 'proseline:peer:'

module.exports = Peer

function Peer (id, transportStream) {
  if (!(this instanceof Peer)) return new Peer(id)
  var self = this
  var log = self.log = debug(DEBUG_NAMESPACE + id)
  self.id = id
  self.transportStream = transportStream
  transportStream
    .on('end', function () {
      self.done()
    })
    .on('error', function (error) {
      log(error)
      self.done()
    })

  // Multiplex replication streams over the transport stream.
  var plex = self.plex = multiplex()
  self._sharedStreams = new Map()
  plex.on('error', function (error) {
    log(error)
  })

  plex.on('stream', function (receiveStream, discoveryKey) {
    var sharedStream = duplexify(
      plex.createStream(discoveryKey),
      receiveStream
    )
    var proselineDatabase = databases.proseline
    var log = debug(DEBUG_NAMESPACE + 'replication:' + discoveryKey)
    proselineDatabase.getProject(discoveryKey, function (error, project) {
      if (error) {
        log(error)
        return sharedStream.destroy()
      }
      if (!project) {
        log('unknown discovery key: %o', discoveryKey)
        return sharedStream.destroy()
      }
      if (project.deleted) {
        log('deleted project: %o', discoveryKey)
        return sharedStream.destroy()
      }
      databases.get(discoveryKey, function (error, database) {
        if (error) return log(error)
        self.joinProject(project, database, sharedStream)
      })
    })
  })

  var proseline = databases.proseline

  // Add and remove replication streams as we join and leave projects.
  var pageBusListeners = self._pageBusListeners = {
    'added project': function (discoveryKey) {
      proseline.getProject(discoveryKey, function (error, project) {
        if (error) return log(error)
        databases.get(discoveryKey, function (error, database) {
          if (error) return log(error)
          self.joinProject(project, database)
        })
      })
    },
    'deleted project': function (discoveryKey) {
      self.leaveProject(discoveryKey)
    },
    'overwrote project': function (discoveryKey) {
      proseline.getProject(discoveryKey, function (error, project) {
        if (error) return log(error)
        if (project.deleted) self.leaveProject(discoveryKey)
      })
    }
  }

  Object.keys(pageBusListeners).forEach(function (eventName) {
    pageBus.addListener(eventName, pageBusListeners[eventName])
  })

  plex.pipe(transportStream).pipe(plex)
}

inherits(Peer, EventEmitter)

Peer.prototype.joinProjects = function () {
  var self = this
  var log = self.log
  log('joining projects')
  var proselineDB = databases.proseline
  proselineDB.listProjects(function (error, projects) {
    if (error) return log(error)
    projects.forEach(function (project) {
      if (project.deleted) return
      databases.get(project.discoveryKey, function (error, database) {
        if (error) return log(error)
        self.joinProject(project, database)
      })
    })
  })
}

Peer.prototype.joinProject = function (
  project,
  database,
  sharedStream // optional
) {
  var self = this
  var log = self.log
  var discoveryKey = project.discoveryKey
  if (self._sharedStreams.has(discoveryKey)) return
  log('joining project: %s', discoveryKey)
  var replicationStream = replicate({
    peerID: self.id,
    replicationKey: project.replicationKey,
    encryptionKey: project.encryptionKey,
    discoveryKey,
    projectKeyPair: project.projectKeyPair,
    database
  })
  if (!sharedStream) {
    sharedStream = self.plex.createSharedStream(discoveryKey)
  }
  self._addSharedStream(discoveryKey, sharedStream)
  replicationStream
    .pipe(sharedStream)
    .pipe(replicationStream)
}

Peer.prototype._addSharedStream = function (discoveryKey, stream) {
  var self = this
  var log = self.log
  self._sharedStreams.set(discoveryKey, stream)
  stream
    .once('error', function (error) {
      log(error)
      self._sharedStreams.delete(discoveryKey)
    })
    .once('close', function () {
      self._sharedStreams.delete(discoveryKey)
    })
}

Peer.prototype.leaveProject = function (discoveryKey) {
  var self = this
  var sharedStreams = self._sharedStreams
  var sharedStream = sharedStreams.get(discoveryKey)
  if (sharedStream) {
    sharedStream.destroy()
    sharedStreams.delete(discoveryKey)
  }
  if (self._sharedStreams.size === 0) {
    self.done()
  }
}

Peer.prototype.done = function () {
  this._removePageBusListeners()
  this.emit('done')
}

Peer.prototype._removePageBusListeners = function () {
  var pageBusListeners = this._pageBusListeners
  Object.keys(pageBusListeners).forEach(function (eventName) {
    pageBus.removeListener(eventName, pageBusListeners[eventName])
  })
}
