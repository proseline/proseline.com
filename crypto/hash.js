var sodium = require('sodium-javascript')

module.exports = function (string) {
  var digest = Buffer.alloc(sodium.crypto_generichash_BYTES)
  sodium.crypto_generichash(
    digest,
    Buffer.from(string, 'utf8')
  )
  return digest.toString('hex')
}
