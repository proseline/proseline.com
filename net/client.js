var EventEmitter = require('events').EventEmitter
var HUBS = require('./hubs')
var Peer = require('./peer')
var assert = require('assert')
var databases = require('../db/databases')
var debug = require('debug')('proseline:client')
var inherits = require('inherits')
var pageBus = require('../page-bus')
var signalhub = require('signalhub')
var simpleGet = require('simple-get')
var webRTCSwarm = require('webrtc-swarm')

// TODO: tune maxPeers by last access time

module.exports = Client

function Client () {
  if (!(this instanceof Client)) return new Client()
  var self = this
  self._peers = new Set()
  self._swarms = new Set()
  self._joinSwarms()
  pageBus.on('added project', function (projectDiscoveryKey) {
    databases.proseline.getProject(projectDiscoveryKey, function (error, project) {
      if (error) return debug(error)
      self._joinSwarm(project)
    })
  })
  pageBus.on('deleted project', function (projectDiscoveryKey) {
    self._leaveSwarm(projectDiscoveryKey)
  })
}

inherits(Client, EventEmitter)

Client.prototype._joinSwarms = function () {
  var self = this
  var proselineDB = databases.proseline
  proselineDB.listProjects(function (error, projects) {
    if (error) return debug(error)
    projects.forEach(function (project) {
      if (project.deleted) return
      databases.get(project.projectDiscoveryKey, function (error, database) {
        if (error) return debug(error)
        self._joinSwarm(project, database)
      })
    })
  })
}

Client.prototype._joinSwarm = function (project) {
  assert.strictEqual(typeof project, 'object')
  var self = this
  var projectDiscoveryKey = project.projectDiscoveryKey
  var alreadyJoined = Array.from(self._swarms).some(function (swarm) {
    return swarm.project.projectDiscoveryKey === projectDiscoveryKey
  })
  if (alreadyJoined) return
  databases.get(projectDiscoveryKey, function (error, database) {
    if (error) return debug(error)
    simpleGet.concat({
      url: 'https://iceservers.proseline.com/_servers',
      timeout: 6000
    }, function (error, response, data) {
      var options = { maxPeers: 3 }
      if (!error) options.config = data
      var hub = signalhub('proseline-' + project.projectDiscoveryKey, HUBS)
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
          .on('update', function (projectDiscoveryKey) {
            self.emit('update', projectDiscoveryKey)
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
      debug('joined: %s', project.projectDiscoveryKey)
    })
  })
}

Client.prototype._leaveSwarm = function (projectDiscoveryKey) {
  assert.strictEqual(typeof projectDiscoveryKey, 'string')
  var swarms = this._swarms
  var swarm = Array.from(swarms).find(function (element) {
    return element.project.projectDiscoveryKey === projectDiscoveryKey
  })
  if (swarm) {
    swarms.delete(swarm)
    debug('left: %s', projectDiscoveryKey)
  }
}

Client.prototype.countPeers = function () {
  return this._peers.length
}
