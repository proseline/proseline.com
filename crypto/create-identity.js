var sodium = require('sodium-javascript')

module.exports = function () {
  var publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES)
  var secretKey = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES)
  sodium.crypto_sign_keypair(publicKey, secretKey)
  return {
    secretKey: secretKey.toString('hex'),
    publicKey: publicKey.toString('hex')
  }
}
