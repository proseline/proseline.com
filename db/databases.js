var ProjectDatabase = require('./project')
var ProselineDatabase = require('./proseline')
var debug = require('debug')('proseline:databases')

var proseline = new ProselineDatabase()

var cache = {proseline}

module.exports = {cache, proseline, setup, get}

function setup (done) {
  debug('initializing "proseline"')
  cache.proseline.init(done)
}

function get (id, callback) {
  if (cache.hasOwnProperty(id)) {
    var cached = cache[id]
    if (cached.ready) return callback(null, cached)
    cached.once('ready', function () {
      callback(null, cached)
    })
  }
  var db = new ProjectDatabase(id)
  cache[id] = db
  debug('initializing "' + id + '"')
  var errored = false
  db.once('ready', function () {
    if (!errored) callback(null, db)
  })
  db.init(function (error) {
    if (error) {
      errored = true
      delete cache[id]
      return callback(error)
    }
  })
}
