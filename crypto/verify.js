var sodium = require('sodium-javascript')

module.exports = function (message, signature, publicKey) {
  return sodium.crypto_sign_verify_detached(
    Buffer.from(signature, 'hex'),
    Buffer.from(message),
    Buffer.from(publicKey, 'hex')
  )
}
