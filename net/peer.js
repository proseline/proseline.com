/* global fetch */
var UNTITLED = require('../untitled')
var EventEmitter = require('events').EventEmitter
var InvitationProtocol = require('proseline-protocol').Invitation
var databases = require('../db/databases')
var debug = require('debug')
var duplexify = require('duplexify')
var hashHex = require('../crypto/hash-hex')
var inherits = require('inherits')
var keyPairFromSeed = require('../crypto/key-pair-from-seed')
var multiplex = require('multiplex')
var pageBus = require('../page-bus')
var replicate = require('./replicate')
var runSeries = require('run-series')
var sign = require('../crypto/sign')
var stringify = require('fast-json-stable-stringify')
var verify = require('../crypto/verify')

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

  if (persistent) {
    var protocol = new InvitationProtocol()

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
        fetch('https://paid.proseline.com/publickey')
          .then(function (response) { return response.text() })
          .then(function (fetchedPublicKey) {
            if (!/^[a-f0-9]{64}$/.test(fetchedPublicKey)) {
              return log('invalid public key')
            }
            var publicKey = invitation.publicKey
            var validSignature = verify(
              stringify(invitation.message),
              invitation.signature,
              publicKey
            )
            if (!validSignature) return log('invalid signature')
            if (publicKey !== fetchedPublicKey) {
              return log('public key mismatch')
            }
            project.title = invitation.message.title || UNTITLED
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
          })
          .catch(function (error) { log(error) })
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

        var email = subscription.email
        proseline.getUserIdentity(function (error, identity) {
          if (error) return log(error)

          // Invite to projects added later.
          pageBusListeners['added project'] = onProject
          pageBusListeners['overwrote project'] = onProject
          function onProject (discoveryKey) {
            proseline.getProject(discoveryKey, function (error, project) {
              if (error) return log(error)
              if (project.persistent) sendInvitation(project)
            })
          }

          // Invite to existing projects.
          proseline.listProjects(function (error, projects) {
            if (error) return log(error)
            projects.forEach(function (project) {
              if (project.persistent) sendInvitation(project)
            })
          })

          var invitationsSent = new Set()

          function sendInvitation (project) {
            var discoveryKey = project.discoveryKey
            if (invitationsSent.has(discoveryKey)) return
            var message = {
              replicationKey: project.replicationKey,
              writeSeed: project.writeSeed,
              title: project.title || UNTITLED
            }
            var stringified = stringify(message)
            var envelope = {
              message,
              publicKey: identity.publicKey,
              signature: sign(stringified, identity.secretKey)
            }
            log('sending invitation: %o', discoveryKey)
            protocol.invitation(envelope, function (error) {
              if (error) return log(error)
              invitationsSent.add(discoveryKey)
              log('sent invitation: %o', discoveryKey)
            })
          }

          // Request invitations.
          var message = {email, date: new Date().toISOString()}
          var stringified = stringify(message)
          var envelope = {
            message,
            publicKey: identity.publicKey,
            signature: sign(stringified, identity.secretKey)
          }
          log('sending request: %s', email)
          protocol.request(envelope, function (error) {
            if (error) return log(error)
            log('sent request: %s', email)
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
    publicKey: project.writeKeyPair.publicKey,
    secretKey: project.writeKeyPair.secretKey,
    discoveryKey,
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
