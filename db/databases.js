var ProjectDatabase = require('./project')
var ProselineDatabase = require('./proseline')
var debug = require('debug')('proseline:databases')

var cache = {
  proseline: new ProselineDatabase()
}

module.exports = {cache, setup, get}

function setup (done) {
  debug('initializing "proseline"')
  cache.proseline.init(done)
}

function get (id, callback) {
  if (cache.hasOwnProperty(id)) return callback(null, cache[id])
  var db = new ProjectDatabase(id)
  cache[id] = db
  debug('initializing "' + id + '"')
  db.init(function (error) {
    if (error) {
      delete cache[id]
      return callback(error)
    }
    callback(null, db)
  })
}
