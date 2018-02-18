var sodium = require('sodium-javascript')

module.exports = function (message, signature, publicKey) {
  return sodium.crypto_sign_verify_detached(
    Buffer.from(signature, 'hex'),
    message,
    Buffer.from(publicKey, 'hex')
  )
}
