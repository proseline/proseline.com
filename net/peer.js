var HUBS = require('./hubs')
var replicate = require('./replicate')
var signalhub = require('signalhub')
var webRTCSwarm = require('webrtc-swarm')

module.exports = {joinSwarm, leaveSwarm}

var swarms = []

function joinSwarm (project, database) {
  var alreadyJoined = swarms.some(function (swarm) {
    return swarm.project.discoveryKey === project.discoveryKey
  })
  if (alreadyJoined) return
  var hub = signalhub('proseline-' + project.discoveryKey, HUBS)
  var swarm = webRTCSwarm(hub, {maxPeers: 3})
  swarm.on('peer', function (peer, id) {
    var replicationStream = replicate({
      secretKey: project.secretKey,
      discoveryKey: project.discoveryKey,
      database
    })
    replicationStream.pipe(peer).pipe(replicationStream)
  })
  swarms.push({
    project: project,
    swarm: swarm
  })
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