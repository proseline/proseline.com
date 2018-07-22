var EventEmitter = require('events').EventEmitter
var keyPairFromSeed = require('../crypto/key-pair-from-seed')
var InvitationProtocol = require('proseline-protocol').Invitation
var databases = require('../db/databases')
var debug = require('debug')
var duplexify = require('duplexify')
var flushWriteStream = require('flush-write-stream')
var hashHex = require('../crypto/hash-hex')
var inherits = require('inherits')
var multiplex = require('multiplex')
var replicate = require('./replicate')
var runSeries = require('run-series')
var sign = require('../crypto/sign')
var stringify = require('fast-json-stable-stringify')

var DEBUG_NAMESPACE = 'proseline:peer:'

module.exports = Peer

function Peer (id, transportStream, persistent) {
  if (!(this instanceof Peer)) return new Peer(id)
  var self = this
  var log = self.log = debug(DEBUG_NAMESPACE + id)
  self.id = id
  self.transportStream = transportStream
  transportStream
    .on('end', function () {
      self.emit('done')
    })
    .on('error', function (error) {
      log(error)
      self.emit('done')
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

  // Add and remove replication streams as we join and leave projects.
  databases.proseline
    .on('added project', function (project) {
      var discoveryKey = project.discoveryKey
      databases.get(discoveryKey, function (error, database) {
        if (error) return log(error)
        self.joinProject(project, database)
      })
    })
    .on('deleted project', function (discoveryKey) {
      self.leaveProject(discoveryKey)
    })

  if (persistent) {
    var protocol = new InvitationProtocol()
    var proseline = databases.proseline

    // On receiving an invitation, join the project.
    protocol.on('invitation', function (invitation) {
      log('invited: %o', invitation)
      var replicationKey = invitation.message.replicationKey
      var discoveryKey = hashHex(replicationKey)
      var writeSeed = invitation.message.writeSeed
      var project = {replicationKey, discoveryKey, writeSeed}
      if (!writeSeed) return log('no write seed')
      project.writeKeyPair = keyPairFromSeed(writeSeed)
      proseline.getProject(discoveryKey, function (error, existing) {
        if (error) return log(error)
        if (existing) {
          log('already have project')
          if (existing.deleted) return log('deleted project')
          return replicateProject(function (error) {
            if (error) return log(error)
          })
        }
        project.title = invitation.message.title || 'Untitled Project'
        // TODO: Deduplicate project join code in peer and model.
        runSeries([
          function indexProjectInProselineDB (done) {
            proseline.putProject(project, done)
          },
          function createProjectDBAndIdentity (done) {
            databases.get(discoveryKey, function (error, db) {
              if (error) return done(error)
              db.createIdentity(true, done)
            })
          },
          replicateProject
        ], function (error) {
          if (error) return log(error)
        })

        function replicateProject (callback) {
          databases.get(discoveryKey, function (error, db) {
            if (error) return callback(error)
            self.joinProject(project, db)
            callback()
          })
        }
      })
    })

    protocol.once('handshake', function () {
      log('received handshake')
      // If we have a subscription...
      proseline.getSubscription(function (error, subscription) {
        if (error) return log(error)
        if (!subscription) return log('no subscription')
        log('streaming projects')
        // Create a stream of all existing and later-joined projects.
        proseline.createProjectStream()
          .pipe(flushWriteStream.obj(function (chunk, _, done) {
            // Send an invitation to the problem to the persistent peer.
            proseline.getUserIdentity(function (error, identity) {
              if (error) return done(error)
              var message = {
                replicationKey: chunk.replicationKey,
                writeSeed: chunk.writeSeed,
                title: chunk.title || 'Untitled Project'
              }
              var stringified = stringify(message)
              var envelope = {
                message,
                publicKey: identity.publicKey,
                signature: sign(stringified, identity.secretKey)
              }
              log('sending invitation: %o', chunk.discoveryKey)
              protocol.invitation(envelope, function (error) {
                if (error) return log(error)
              })
            })
          }))
        // Request invitations.
        var email = subscription.email
        proseline.getUserIdentity(function (error, identity) {
          if (error) return log(error)
          var message = {email, date: new Date().toISOString()}
          var stringified = stringify(message)
          var envelope = {
            message,
            publicKey: identity.publicKey,
            signature: sign(stringified, identity.secretKey)
          }
          log('requesting invitations: %o', subscription)
          protocol.request(envelope, function (error) {
            if (error) return log(error)
          })
        })
      })
    })

    protocol.on('invalid', function (body) {
      log('invalid message: %o', body)
    })

    protocol
      .pipe(plex.createSharedStream('invitation'))
      .pipe(protocol)

    // Extend our handshake.
    log('sending handshake')
    protocol.handshake(function (error) {
      if (error) return log(error)
      log('sent handshake')
    })
  }

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
    replicationKey: project.replicationKey,
    publicKey: project.writeKeyPair.publicKey,
    secretKey: project.writeKeyPair.secretKey,
    discoveryKey,
    database,
    onUpdate: function (discoveryKey) {
      self.emit('update', discoveryKey)
    }
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
    self.emit('done')
    self.transportStream.destroy()
  }
}
