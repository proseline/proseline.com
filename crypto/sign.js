var sodium = require('sodium-javascript')

module.exports = function (message, secretKey) {
  var signature = Buffer.alloc(64)
  sodium.crypto_sign_detached(
    signature,
    Buffer.from(message, 'utf8'),
    Buffer.from(secretKey, 'hex')
  )
  return signature.toString('hex')
}
