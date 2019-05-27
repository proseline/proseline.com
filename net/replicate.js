var Protocol = require('./protocol')
var assert = require('nanoassert')
var crypto = require('@proseline/crypto')
var debug = require('debug')
var pageBus = require('../page-bus')
var runSeries = require('run-series')

var DEBUG_NAMESPACE = 'proseline:replicate:'

module.exports = function (options) {
  assert(typeof options.peerID === 'string')
  assert(typeof options.replicationKey === 'string')
  assert(typeof options.discoveryKey === 'string')
  assert(typeof options.encryptionKey === 'string')
  assert(typeof options.projectPublicKey === 'object')
  assert(options.database)
  var replicationKey = options.replicationKey
  var discoveryKey = options.discoveryKey
  var encryptionKey = options.encryptionKey
  var projectPublicKey = options.projectPublicKey
  var database = options.database

  var log = debug(DEBUG_NAMESPACE + options.peerID + ':' + discoveryKey)

  var protocol = new Protocol({
    key: Buffer.from(replicationKey, 'base64')
  })

  var listeningToDatabase = false

  protocol.once('handshake', function () {
    log('received handshake')
    // Offer new outer envelopes as we receive them.
    pageBus.addListener('envelope', onEnvelope)
    listeningToDatabase = true
    // Offer outer envelopes we already have.
    database.listLogs(function (error, logPublicKeys) {
      if (error) return log(error)
      logPublicKeys.forEach(function (logPublicKey) {
        database.getLogHead(logPublicKey, function (error, index) {
          if (error) return log(error)
          offerEnvelope(logPublicKey, index)
        })
      })
    })
  })

  function onEnvelope (envelope) {
    if (envelope.discoveryKey !== discoveryKey) return
    offerEnvelope(envelope.logPublicKey, envelope.index)
  }

  function offerEnvelope (logPublicKey, index) {
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
    database.getEntry(logPublicKey, index, function (error, entry) {
      if (error) return log(error)
      if (entry === undefined) return
      log('sending outer envelope: %s', id)
      protocol.envelope(entry.envelope, function (error) {
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
  protocol.on('envelope', function (envelope) {
    var id = loggingID(envelope.logPublicKey, envelope.index)
    var errors = crypto.validateEnvelope({
      envelope,
      projectPublicKey,
      encryptionKey
    })
    if (errors.length !== 0) {
      throw new Error('Failed to validate envelope.')
    }
    var entry = crypto.decryptJSON(
      envelope.entry.ciphertext,
      envelope.entry.nonce,
      encryptionKey
    )
    log('received envelope: %s', id)
    database.putEnvelope(envelope, entry, function (error) {
      if (error) return log(error)
      log('put envelope: %s', id)
    })
  })

  protocol.on('invalid', function (body) {
    log('received invalid entry: %O', body)
  })

  protocol.on('error', function (error) {
    log(error)
    if (listeningToDatabase) {
      database.removeListener('envelope', onEnvelope)
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
