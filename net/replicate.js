var ReplicationProtocol = require('proseline-protocol').Replication
var assert = require('assert')
var debug = require('debug')('proseline:replicate')
var flushWriteStream = require('flush-write-stream')
var validate = require('../schemas/validate')

module.exports = function (options) {
  assert.equal(typeof options.secretKey, 'string')
  assert.equal(typeof options.discoveryKey, 'string')
  assert(options.database)
  assert(typeof options.onUpdate, 'function')
  var secretKey = options.secretKey
  var discoveryKey = options.discoveryKey
  var database = options.database
  var onUpdate = options.onUpdate

  var protocol = new ReplicationProtocol(secretKey)

  // Store a list of envelopes that we've requested, so we can
  // check the list to avoid offering this peer envelopes we've
  // just received from it.
  var requestedFromPeer = []

  protocol.once('handshake', function () {
    database.createOfferStream()
      .pipe(flushWriteStream.obj(function (chunk, _, done) {
        var requestIndex = requestedFromPeer
          .findIndex(function (request) {
            return (
              request.publicKey === chunk.publicKey &&
              request.index === chunk.index
            )
          })
        if (requestIndex === -1) {
          return protocol.offer(chunk, done)
        }
        requestedFromPeer.splice(requestIndex, 1)
        done()
      }))
  })

  // When our peer requests an envelope...
  protocol.on('request', function (request) {
    debug('requested: %o', request)
    var publicKey = request.publicKey
    var index = request.index
    database.getEnvelope(publicKey, index, function (error, envelope) {
      if (error) return debug(error)
      if (envelope === undefined) return
      protocol.envelope(envelope)
    })
  })

  // TODO: Prevent duplicate requests for the same envelope.

  // When our peer offers envelopes...
  protocol.on('offer', function (offer) {
    debug('offered: %o', offer)
    var publicKey = offer.publicKey
    var offeredIndex = offer.index
    database.getLogHead(publicKey, function (error, head) {
      if (error) return debug(error)
      if (head === undefined) head = -1
      var index = head + 1
      requestNextEnvelope()
      function requestNextEnvelope () {
        if (index > offeredIndex) return
        protocol.request({publicKey, index}, function (error) {
          if (error) return debug(error)
          requestedFromPeer.push({publicKey, index})
          index++
          requestNextEnvelope()
        })
      }
    })
  })

  // When our peer sends an envelope...
  protocol.on('envelope', function (envelope) {
    debug('sent envelope: %o', envelope)
    // Validate envelope schema and signature.
    if (!validate.envelope(envelope)) {
      return debug('invalid envelope')
    }
    // Validate body.
    if (!validate.body(envelope.message.body)) {
      return debug('invalid body')
    }
    // Ensure body is for this project.
    if (envelope.message.project !== discoveryKey) {
      return debug('project mismatch')
    }
    // Write to our database.
    database.putEnvelope(envelope, function (error) {
      if (error) return debug(error)
    })
    // Call back about the update.
    onUpdate(envelope.project)
  })

  protocol.on('invalid', function (body) {
    debug('invalid message: %o', body)
  })

  // Extend our handshake.
  protocol.handshake(function (error) {
    if (error) return debug(error)
  })

  return protocol
}
