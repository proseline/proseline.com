var Protocol = require('./protocol')
var assert = require('assert')
var debug = require('debug')
var pageBus = require('../page-bus')
var runSeries = require('run-series')

var DEBUG_NAMESPACE = 'proseline:replicate:'

module.exports = function (options) {
  assert.strictEqual(typeof options.peerID, 'string')
  assert.strictEqual(typeof options.projectReplicationKey, 'string')
  assert.strictEqual(typeof options.projectDiscoveryKey, 'string')
  assert(options.database)
  var projectReplicationKey = options.projectReplicationKey
  var projectDiscoveryKey = options.projectDiscoveryKey
  var database = options.database

  var log = debug(DEBUG_NAMESPACE + options.peerID + ':' + projectDiscoveryKey)

  var protocol = new Protocol({ key: projectReplicationKey })

  var listeningToDatabase = false

  protocol.once('handshake', function () {
    log('received handshake')
    // Offer new outer envelopes as we receive them.
    pageBus.addListener('outerEnvelope', onOuterEnvelope)
    listeningToDatabase = true
    // Offer outer envelopes we already have.
    database.listLogs(function (error, publicKeys) {
      if (error) return log(error)
      publicKeys.forEach(function (publicKey) {
        database.getLogHead(publicKey, function (error, index) {
          if (error) return log(error)
          offerOuterEnvelope(publicKey, index)
        })
      })
    })
  })

  function onOuterEnvelope (outerEnvelope) {
    var project = outerEnvelope.project
    if (project !== projectDiscoveryKey) return
    offerOuterEnvelope(outerEnvelope.logPublicKey, outerEnvelope.index)
  }

  function offerOuterEnvelope (logPublicKey, index) {
    var id = loggingID(logPublicKey, index)
    log('sending offer: %s', id)
    protocol.offer({ logPublicKey, index }, function (error) {
      if (error) return log(error)
      log('sent offer: %s', id)
    })
  }

  // When our peer requests an outer envelope...
  protocol.on('request', function (request) {
    var logPublicKey = request.logPublicKey
    var index = request.index
    var id = loggingID(logPublicKey, index)
    log('received request: %s', id)
    database.getOuterEnvelope(logPublicKey, index, function (error, outerEnvelope) {
      if (error) return log(error)
      if (outerEnvelope === undefined) return
      log('sending outer envelope: %s', id)
      protocol.envelope(outerEnvelope, function (error) {
        if (error) return log(error)
        log('sent outer envelope: %s', id)
      })
    })
  })

  // TODO: Prevent duplicate requests for the same outer envelope.

  // When our peer offers outer envelopes...
  protocol.on('offer', function (offer) {
    var logPublicKey = offer.logPublicKey
    var offeredIndex = offer.index
    var offeredID = loggingID(logPublicKey, offeredIndex)
    log('received offer: %s', offeredID)
    database.getLogHead(logPublicKey, function (error, head) {
      if (error) return log(error)
      if (head === undefined) head = -1
      var indexes = inclusiveRange(head + 1, offeredIndex)
      runSeries(indexes.map(function (index) {
        var requestID = loggingID(logPublicKey, index)
        return function (done) {
          log('sending request: %s', requestID)
          protocol.request({ logPublicKey, index }, function (error) {
            if (error) log(error)
            else log('sent request: %s', requestID)
            done()
          })
        }
      }))
    })
  })

  // When our peer sends an outer envelope...
  protocol.on('outerEnvelope', function (outerEnvelope) {
    var id = loggingID(outerEnvelope.logPublicKey, outerEnvelope.index)
    log('received outer envelope: %s', id)
    database.putOuterEnvelope(outerEnvelope, function (error) {
      if (error) return log(error)
      log('put outer envelope: %s', id)
    })
  })

  protocol.on('invalid', function (body) {
    log('received invalid entry: %O', body)
  })

  protocol.on('error', function (error) {
    log(error)
    if (listeningToDatabase) {
      database.removeListener('outerEnvelope', onOuterEnvelope)
    }
  })

  // Extend our handshake.
  log('sending handshake')
  protocol.handshake(function (error) {
    if (error) return log(error)
    log('sent handshake')
  })

  return protocol
}

function loggingID (logPublicKey, index) {
  return logPublicKey + ' # ' + index
}

function inclusiveRange (from, to) {
  if (from > to) return []
  if (from === to) return [from]
  var returned = []
  for (var index = from; index <= to; index++) {
    returned.push(index)
  }
  return returned
}
