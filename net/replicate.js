var Protocol = require('./protocol')
var assert = require('assert')
var debug = require('debug')
var pageBus = require('../page-bus')
var runSeries = require('run-series')

var DEBUG_NAMESPACE = 'proseline:replicate:'

module.exports = function (options) {
  assert.strictEqual(typeof options.peerID, 'string')
  assert.strictEqual(typeof options.replicationKey, 'string')
  assert.strictEqual(typeof options.projectDiscoveryKey, 'string')
  assert.strictEqual(typeof options.publicKey, 'string')
  assert.strictEqual(typeof options.secretKey, 'string')
  assert(options.database)
  var replicationKey = options.replicationKey
  var projectDiscoveryKey = options.projectDiscoveryKey
  var database = options.database

  var log = debug(DEBUG_NAMESPACE + options.peerID + ':' + projectDiscoveryKey)

  var protocol = new Protocol({ key: replicationKey })

  var listeningToDatabase = false

  protocol.once('handshake', function () {
    log('received handshake')
    // Offer new envelopes as we receive them.
    pageBus.addListener('outerEnvelope', onOuterEnvelope)
    listeningToDatabase = true
    // Offer envelopes we already have.
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
    offerOuterEnvelope(outerEnvelope.publicKey, outerEnvelope.index)
  }

  function offerOuterEnvelope (publicKey, index) {
    var id = loggingID(publicKey, index)
    log('sending offer: %s', id)
    protocol.offer({ publicKey, index }, function (error) {
      if (error) return log(error)
      log('sent offer: %s', id)
    })
  }

  // When our peer requests an envelope...
  protocol.on('request', function (request) {
    var publicKey = request.publicKey
    var index = request.index
    var id = loggingID(publicKey, index)
    log('received request: %s', id)
    database.getOuterEnvelope(publicKey, index, function (error, outerEnvelope) {
      if (error) return log(error)
      if (outerEnvelope === undefined) return
      log('sending outer envelope: %s', id)
      protocol.envelope(outerEnvelope, function (error) {
        if (error) return log(error)
        log('sent outer envelope: %s', id)
      })
    })
  })

  // TODO: Prevent duplicate requests for the same envelope.

  // When our peer offers envelopes...
  protocol.on('offer', function (offer) {
    var publicKey = offer.publicKey
    var offeredIndex = offer.index
    var offeredID = loggingID(publicKey, offeredIndex)
    log('received offer: %s', offeredID)
    database.getLogHead(publicKey, function (error, head) {
      if (error) return log(error)
      if (head === undefined) head = -1
      var indexes = inclusiveRange(head + 1, offeredIndex)
      runSeries(indexes.map(function (index) {
        var requestID = loggingID(publicKey, index)
        return function (done) {
          log('sending request: %s', requestID)
          protocol.request({ publicKey, index }, function (error) {
            if (error) log(error)
            else log('sent request: %s', requestID)
            done()
          })
        }
      }))
    })
  })

  // When our peer sends an envelope...
  protocol.on('outerEnvelope', function (envelope) {
    var id = loggingID(envelope.publicKey, envelope.message.index)
    log('received envelope: %s', id)
    database.putOuterEnvelope(envelope, function (error) {
      if (error) return log(error)
      log('put envelope: %s', id)
    })
  })

  protocol.on('invalid', function (body) {
    log('received invalid message: %O', body)
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

function loggingID (publicKey, index) {
  return publicKey + ' # ' + index
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
