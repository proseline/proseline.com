var ReplicationProtocol = require('proseline-protocol').Replication
var assert = require('assert')
var debug = require('debug')
var flushWriteStream = require('flush-write-stream')

var DEBUG_NAMESPACE = 'proseline:replicate:'

module.exports = function (options) {
  assert.equal(typeof options.replicationKey, 'string')
  assert.equal(typeof options.discoveryKey, 'string')
  assert.equal(typeof options.publicKey, 'string')
  assert.equal(typeof options.secretKey, 'string')
  assert(options.database)
  assert(typeof options.onUpdate, 'function')
  var replicationKey = options.replicationKey
  var discoveryKey = options.discoveryKey
  var publicKey = options.publicKey
  var secretKey = options.secretKey
  var database = options.database
  var onUpdate = options.onUpdate
  var log = debug(DEBUG_NAMESPACE + discoveryKey)

  var protocol = new ReplicationProtocol({
    replicationKey, publicKey, secretKey
  })

  // Store a list of envelopes that we've requested, so we can
  // check the list to avoid offering this peer envelopes we've
  // just received from it.
  var requestedFromPeer = []

  protocol.once('handshake', function () {
    log('received handshake')
    database.createOfferStream()
      .pipe(flushWriteStream.obj(function (chunk, _, done) {
        var publicKey = chunk.publicKey
        var index = chunk.index
        var requestIndex = requestedFromPeer
          .findIndex(function (request) {
            return (
              request.publicKey === publicKey &&
              request.index === index
            )
          })
        if (requestIndex === -1) {
          log('sending offer: %s#%d', publicKey, index)
          return protocol.offer(chunk, done)
        }
        requestedFromPeer.splice(requestIndex, 1)
        done()
      }))
  })

  // When our peer requests an envelope...
  protocol.on('request', function (request) {
    var publicKey = request.publicKey
    var index = request.index
    log('received request: %s#%d', publicKey, index)
    database.getEnvelope(publicKey, index, function (error, envelope) {
      if (error) return log(error)
      if (envelope === undefined) return
      log('sending envelope: %s#%d', envelope.publicKey, envelope.message.index)
      protocol.envelope(envelope)
    })
  })

  // TODO: Prevent duplicate requests for the same envelope.

  // When our peer offers envelopes...
  protocol.on('offer', function (offer) {
    log('received offer: %o', offer)
    var publicKey = offer.publicKey
    var offeredIndex = offer.index
    database.getLogHead(publicKey, function (error, head) {
      if (error) return log(error)
      if (head === undefined) head = 0
      for (var index = head + 1; index <= offeredIndex; index++) {
        log('sending request: %s#%d', publicKey, index)
        protocol.request({publicKey, index}, function (error) {
          if (error) return log(error)
          requestedFromPeer.push({publicKey, index})
        })
      }
    })
  })

  // When our peer sends an envelope...
  protocol.on('envelope', function (envelope) {
    log('received envelope: %s#%d', envelope.publicKey, envelope.message.index)
    database.putEnvelope(envelope, function (error) {
      if (error) return log(error)
    })
    // Call back about the update.
    onUpdate(envelope.project)
  })

  protocol.on('invalid', function (body) {
    log('received invalid message: %O', body)
  })

  // Extend our handshake.
  log('sending handshake')
  protocol.handshake(function (error) {
    if (error) return log(error)
    log('sent handshake')
  })

  return protocol
}
