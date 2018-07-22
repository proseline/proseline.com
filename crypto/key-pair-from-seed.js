var assert = require('assert')
var sodium = require('sodium-javascript')

module.exports = function (seedString) {
  assert.equal(typeof seedString, 'string')
  var seed = Buffer.from(seedString, 'hex')
  var publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES)
  var secretKey = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES)
  sodium.crypto_sign_keypair(publicKey, secretKey)
  sodium.crypto_sign_seed_keypair(publicKey, secretKey, seed)
  return {
    secretKey: secretKey.toString('hex'),
    publicKey: publicKey.toString('hex')
  }
}
