var EventEmitter = require('events').EventEmitter
var HUBS = require('./hubs')
var Peer = require('./peer')
var assert = require('assert')
var databases = require('../db/databases')
var debug = require('debug')('proseline:client')
var inherits = require('inherits')
var signalhub = require('signalhub')
var simpleGet = require('simple-get')
var webRTCSwarm = require('webrtc-swarm')

// TODO: tune maxPeers by last access time

module.exports = Client

function Client () {
  if (!(this instanceof Client)) {
    return new Client()
  }
  var self = this
  self._peers = new Set()
  self._swarms = new Set()
  self._joinSwarms()
  databases.cache.proseline
    .on('added project', function (project) {
      self._joinSwarm(project)
    })
    .on('deleted project', function (discoveryKey) {
      self._leaveSwarm(discoveryKey)
    })
}

inherits(Client, EventEmitter)

Client.prototype._joinSwarms = function () {
  var self = this
  var proselineDB = databases.cache.proseline
  proselineDB.listProjects(function (error, projects) {
    if (error) return debug(error)
    projects.forEach(function (project) {
      databases.get(project.discoveryKey, function (error, database) {
        if (error) return debug(error)
        self._joinSwarm(project, database)
      })
    })
  })
}

Client.prototype._joinSwarm = function (project) {
  assert.equal(typeof project, 'object')
  var self = this
  var discoveryKey = project.discoveryKey
  var alreadyJoined = Array.from(self._swarms).some(function (swarm) {
    return swarm.project.discoveryKey === discoveryKey
  })
  if (alreadyJoined) return
  databases.get(discoveryKey, function (error, database) {
    if (error) return debug(error)
    simpleGet.concat({
      url: 'https://iceservers.proseline.com/_servers',
      timeout: 6000
    }, function (error, response, data) {
      var options = {maxPeers: 3}
      if (!error) options.config = data
      var hub = signalhub('proseline-' + project.discoveryKey, HUBS)
      var swarm = webRTCSwarm(hub, options)
      swarm.on('peer', function (transportStream, id) {
        debug('peer: %o', id)
        var alreadyConnected = Array.from(self._peers)
          .some(function (peer) {
            return peer.id === id
          })
        if (alreadyConnected) {
          debug('already connected: %o', id)
          return
        }
        var peer = new Peer(id, transportStream)
        peer
          .on('update', function (discoveryKey) {
            self.emit('update', discoveryKey)
          })
          .once('done', function () {
            self._peers.delete(peer)
          })
        self._peers.add(peer)
        peer.joinProjects()
      })
      self._swarms.add({
        project: project,
        swarm: swarm
      })
      debug('joined: %s', project.discoveryKey)
    })
  })
}

Client.prototype._leaveSwarm = function (discoveryKey) {
  assert.equal(typeof discoveryKey, 'string')
  var swarms = this._swarms
  var swarm = Array.from(swarms).find(function (element) {
    return element.project.discoveryKey === discoveryKey
  })
  if (swarm) {
    swarms.delete(swarm)
    debug('left: %s', discoveryKey)
  }
}

Client.prototype.countPeers = function () {
  return this._peers.length
}
