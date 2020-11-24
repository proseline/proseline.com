const EventEmitter = require('events').EventEmitter
const databases = require('../db/databases')
const debug = require('debug')
const duplexify = require('duplexify')
const inherits = require('inherits')
const multiplex = require('multiplex')
const pageBus = require('../page-bus')
const replicate = require('./replicate')

const DEBUG_NAMESPACE = 'proseline:peer:'

module.exports = Peer

function Peer (id, transportStream) {
  if (!(this instanceof Peer)) return new Peer(id)
  const self = this
  const log = self.log = debug(DEBUG_NAMESPACE + id)
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
  const plex = self.plex = multiplex()
  self._sharedStreams = new Map()
  plex.on('error', function (error) {
    log(error)
  })

  plex.on('stream', function (receiveStream, discoveryKey) {
    const sharedStream = duplexify(
      plex.createStream(discoveryKey),
      receiveStream
    )
    const proselineDatabase = databases.proseline
    const log = debug(DEBUG_NAMESPACE + 'replication:' + discoveryKey)
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

  const proseline = databases.proseline

  // Add and remove replication streams as we join and leave projects.
  const pageBusListeners = self._pageBusListeners = {
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
  const self = this
  const log = self.log
  log('joining projects')
  const proselineDB = databases.proseline
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
  const self = this
  const log = self.log
  const discoveryKey = project.discoveryKey
  if (self._sharedStreams.has(discoveryKey)) return
  log('joining project: %s', discoveryKey)
  const replicationStream = replicate({
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
  const self = this
  const log = self.log
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
  const self = this
  const sharedStreams = self._sharedStreams
  const sharedStream = sharedStreams.get(discoveryKey)
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
  const pageBusListeners = this._pageBusListeners
  Object.keys(pageBusListeners).forEach(function (eventName) {
    pageBus.removeListener(eventName, pageBusListeners[eventName])
  })
}
