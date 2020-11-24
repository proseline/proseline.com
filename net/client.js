const EventEmitter = require('events').EventEmitter
const HUBS = require('./hubs')
const Peer = require('./peer')
const assert = require('nanoassert')
const databases = require('../db/databases')
const debug = require('debug')('proseline:client')
const inherits = require('inherits')
const pageBus = require('../page-bus')
const signalhub = require('signalhub')
const simpleGet = require('simple-get')
const webRTCSwarm = require('webrtc-swarm')

// TODO: tune maxPeers by last access time

module.exports = Client

function Client () {
  if (!(this instanceof Client)) return new Client()
  const self = this
  self._peers = new Set()
  self._swarms = new Set()
  self._joinSwarms()
  pageBus.on('added project', function (discoveryKey) {
    databases.proseline.getProject(discoveryKey, function (error, project) {
      if (error) return debug(error)
      self._joinSwarm(project)
    })
  })
  pageBus.on('deleted project', function (discoveryKey) {
    self._leaveSwarm(discoveryKey)
  })
}

inherits(Client, EventEmitter)

Client.prototype._joinSwarms = function () {
  const self = this
  const proselineDB = databases.proseline
  proselineDB.listProjects(function (error, projects) {
    if (error) return debug(error)
    projects.forEach(function (project) {
      if (project.deleted) return
      databases.get(project.discoveryKey, function (error, database) {
        if (error) return debug(error)
        self._joinSwarm(project, database)
      })
    })
  })
}

Client.prototype._joinSwarm = function (project) {
  assert(typeof project === 'object')
  const self = this
  const discoveryKey = project.discoveryKey
  const alreadyJoined = Array.from(self._swarms).some(function (swarm) {
    return swarm.project.discoveryKey === discoveryKey
  })
  if (alreadyJoined) return
  databases.get(discoveryKey, function (error, database) {
    if (error) return debug(error)
    simpleGet.concat({
      url: 'https://iceservers.proseline.com/_servers',
      timeout: 6000
    }, function (error, response, data) {
      const options = { maxPeers: 3 }
      if (!error) options.config = data
      const hub = signalhub('proseline-' + project.discoveryKey, HUBS)
      const swarm = webRTCSwarm(hub, options)
      swarm.on('peer', function (transportStream, id) {
        debug('peer: %o', id)
        const alreadyConnected = Array.from(self._peers)
          .some(function (peer) {
            return peer.id === id
          })
        if (alreadyConnected) {
          debug('already connected: %o', id)
          return
        }
        const peer = new Peer(id, transportStream)
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
  assert(typeof discoveryKey === 'string')
  const swarms = this._swarms
  const swarm = Array.from(swarms).find(function (element) {
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
