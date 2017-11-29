var assert = require('assert')
var sodium = require('sodium-javascript')

module.exports = function (string) {
  assert(typeof string === 'string')
  assert(string.length > 0)
  var digest = Buffer.alloc(sodium.crypto_generichash_BYTES)
  sodium.crypto_generichash(
    digest,
    Buffer.from(string, 'utf8')
  )
  return digest.toString('hex')
}
