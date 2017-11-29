var assert = require('assert')
var sodium = require('sodium-javascript')

module.exports = function (bytes) {
  assert(Number.isInteger(bytes))
  assert(bytes > 0)
  var random = Buffer.alloc(bytes)
  sodium.randombytes_buf(random)
  return random.toString('hex')
}
