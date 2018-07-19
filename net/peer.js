var EventEmitter = require('events').EventEmitter
var InvitationProtocol = require('proseline-protocol').Invitation
var databases = require('../db/databases')
var debug = require('debug')('proseline:peer')
var flushWriteStream = require('flush-write-stream')
var hashHex = require('../crypto/hash-hex')
var inherits = require('inherits')
var multiplex = require('multiplex')
var replicate = require('./replicate')
var runParallel = require('run-parallel')
var runSeries = require('run-series')
var sign = require('../crypto/sign')
var stringify = require('fast-json-stable-stringify')

module.exports = Peer

function Peer (id, transportStream, persistent) {
  if (!(this instanceof Peer)) return new Peer(id)
  var self = this
  self.id = id
  self.transportStream = transportStream
  transportStream
    .on('end', function () {
      self.emit('done')
    })
    .on('error', function (error) {
      debug(error)
      self.emit('done')
    })

  // Multiplex replication streams over the transport stream.
  var plex = self.plex = multiplex()
  self._sharedStreams = new Map()
  plex.on('stream', function (sharedStream, discoveryKey) {
    var proselineDatabase = databases.proseline
    proselineDatabase.getProject(discoveryKey, function (error, project) {
      if (error) {
        debug(error)
        return sharedStream.destroy()
      }
      if (!project) {
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
  databases.proseline
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

  if (persistent) {
    var protocol = new InvitationProtocol()

    var proseline = databases.proseline

    // On receiving an invitation, join the project.
    protocol.on('invitation', function (invitation) {
      debug('invited: %o', invitation)
      var secretKey = invitation.message.secretKey
      var discoveryKey = hashHex(secretKey)
      var title = invitation.message.title || 'Untitled Project'
      var project = {secretKey, discoveryKey, title}
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
        function joinProject (done) {
          if (self._sharedStreams.has(discoveryKey)) return done()
          databases.get(discoveryKey, function (error, db) {
            if (error) return done(error)
            self.joinProject(project, db, done)
          })
        }
      ], function (error) {
        if (error) return debug(error)
      })
    })

    protocol.once('handshake', function () {
      debug('received handshake')
      // If we have a subscription...
      proseline.getSubscription(function (error, subscription) {
        if (error) return debug(error)
        if (!subscription) return
        debug('streaming projects')
        // Create a stream of all existing and later-joined projects.
        proseline.createProjectStream()
          .pipe(flushWriteStream.obj(function (chunk, _, done) {
            // Send an invitation to the problem to the persistent peer.
            proseline.getUserIdentity(function (error, identity) {
              if (error) return done(error)
              var message = {
                secretKey: chunk.secretKey,
                title: chunk.title || 'Untitled Project'
              }
              var stringified = stringify(message)
              var envelope = {
                message,
                publicKey: identity.publicKey,
                signature: sign(stringified, identity.secretKey)
              }
              debug('sending invitation: %o', chunk.discoveryKey)
              protocol.invitation(envelope, function (error) {
                if (error) return debug(error)
              })
            })
          }))
        //  Request invitations.
        var email = subscription.email
        proseline.getUserIdentity(function (error, identity) {
          if (error) return debug(error)
          var message = {email, date: new Date().toISOString()}
          var stringified = stringify(message)
          var envelope = {
            message,
            publicKey: identity.publicKey,
            signature: sign(stringified, identity.secretKey)
          }
          debug('requesting invitations: %o', subscription)
          protocol.request(envelope, function (error) {
            if (error) return debug(error)
          })
        })
      })
    })

    protocol.on('invalid', function (body) {
      debug('invalid message: %o', body)
    })

    protocol
      .pipe(plex.createSharedStream('invitation'))
      .pipe(protocol)

    // Extend our handshake.
    protocol.handshake(function () { /* noop */ })
  }
}

inherits(Peer, EventEmitter)

Peer.prototype.joinProjects = function () {
  var self = this
  var proselineDB = databases.proseline
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
  if (self._sharedStreams.has(discoveryKey)) return
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
  self._addSharedStream(discoveryKey, sharedStream)
  replicationStream
    .pipe(sharedStream)
    .pipe(replicationStream)
}

Peer.prototype._addSharedStream = function (discoveryKey, stream) {
  var self = this
  self._sharedStreams.set(discoveryKey, stream)
  stream.once('close', function () {
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
  if (self.sharedStreams.size === 0) {
    self.emit('done')
    self.transportStream.destroy()
  }
}
