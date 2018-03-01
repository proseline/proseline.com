var HUBS = require('./hubs')
var assert = require('assert')
var debug = require('debug')('proseline:peer')
var replicate = require('./replicate')
var signalhub = require('signalhub')
var simpleGet = require('simple-get')
var webRTCSwarm = require('webrtc-swarm')

// TODO: tune maxPeers by last access time

module.exports = {joinSwarm, leaveSwarm}

var swarms = []

function joinSwarm (project, database) {
  assert.equal(typeof project, 'object')
  assert(database)
  var alreadyJoined = swarms.some(function (swarm) {
    return swarm.project.discoveryKey === project.discoveryKey
  })
  if (alreadyJoined) return
  simpleGet.concat({
    url: 'https://iceservers.proseline.com/_servers',
    timeout: 6000
  }, function (error, response, data) {
    var options = {maxPeers: 3}
    if (!error) options.config = data
    var hub = signalhub('proseline-' + project.discoveryKey, HUBS)
    var swarm = webRTCSwarm(hub, options)
    swarm.on('peer', function (peer, id) {
      debug('peer: %o', id)
      var replicationStream = replicate({
        secretKey: project.secretKey,
        discoveryKey: project.discoveryKey,
        database: database
      })
      replicationStream.pipe(peer).pipe(replicationStream)
    })
    swarms.push({
      project: project,
      swarm: swarm
    })
    debug('joined: %s', project.discoveryKey)
  })
}

function leaveSwarm (discoveryKey) {
  assert.equal(typeof discoveryKey, 'string')
  var index = swarms.findIndex(function (swarm) {
    return swarm.project.discoveryKey === discoveryKey
  })
  if (index !== -1) {
    swarms[index].swarm.close()
    swarms.splice(index, 1)
    debug('left: %s', discoveryKey)
  }
}
