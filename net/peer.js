var HUBS = require('./hubs')
var assert = require('assert')
var debug = require('debug')('proseline:peer')
var replicate = require('./replicate')
var signalhub = require('signalhub')
var webRTCSwarm = require('webrtc-swarm')

module.exports = {joinSwarm, leaveSwarm}

var swarms = []

function joinSwarm (project, database) {
  assert.equal(typeof project, 'string')
  assert(database)
  var alreadyJoined = swarms.some(function (swarm) {
    return swarm.project.discoveryKey === project.discoveryKey
  })
  if (alreadyJoined) return
  var hub = signalhub('proseline-' + project.discoveryKey, HUBS)
  var swarm = webRTCSwarm(hub, {maxPeers: 3})
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
  return swarm
}

function leaveSwarm (project) {
  var index = swarms.findIndex(function (swarm) {
    return swarm.project.discoveryKey === project.discoveryKey
  })
  if (index !== -1) {
    swarms[index].close()
    swarms.splice(index, 1)
  }
}
