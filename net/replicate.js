var Protocol = require('./protocol')
var assert = require('nanoassert')
var crypto = require('@proseline/crypto')
var debug = require('debug')
var pageBus = require('../page-bus')
var runSeries = require('run-series')

var DEBUG_NAMESPACE = 'proseline:replicate:'

module.exports = function (options) {
  assert(typeof options.peerID === 'string')
  assert(typeof options.projectReplicationKey === 'string')
  assert(typeof options.projectDiscoveryKey === 'string')
  assert(typeof options.projectReadKey === 'string')
  assert(typeof options.projectWriteKeyPair === 'object')
  assert(options.database)
  var projectReplicationKey = options.projectReplicationKey
  var projectDiscoveryKey = options.projectDiscoveryKey
  var projectReadKey = options.projectReadKey
  var projectWriteKeyPair = options.projectWriteKeyPair
  var database = options.database

  var log = debug(DEBUG_NAMESPACE + options.peerID + ':' + projectDiscoveryKey)

  var protocol = new Protocol({
    key: Buffer.from(projectReplicationKey, crypto.keyEncoding)
  })

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
    if (outerEnvelope.projectDiscoveryKey !== projectDiscoveryKey) return
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
    // Verify envelope.
    if (outerEnvelope.projectDiscoveryKey !== projectDiscoveryKey) {
      return log('projectDiscoveryKey mismatch')
    }
    var logPublicKey = outerEnvelope.logPublicKey
    var encryptedInnerEnvelope = outerEnvelope.encryptedInnerEnvelope
    var nonce = outerEnvelope.nonce
    var innerEnvelopeJSON = crypto.decrypt(
      encryptedInnerEnvelope, nonce, projectReadKey
    )
    if (!innerEnvelopeJSON) {
      throw new Error('Failed to decrypt encryptedInnerEnvelope.')
    }
    try {
      var innerEnvelope = JSON.parse(innerEnvelopeJSON)
    } catch (error) {
      return log('Failed to parse encryptedInnerEnvelope.')
    }
    var validLogSignature = crypto.verify(
      innerEnvelope, logPublicKey, 'logSignature'
    )
    if (!validLogSignature) {
      return log('Log signature is invalid.')
    }
    var validProjectSignature = crypto.verify(
      innerEnvelope, projectWriteKeyPair.publicKey, 'projectSignature'
    )
    if (!validProjectSignature) {
      return log('Project signature is invalid.')
    }
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
