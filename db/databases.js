var ProjectDatabase = require('./db/project')
var ProselineDatabase = require('./db/proseline')

var cache = {
  proseline: new ProselineDatabase()
}

module.exports = {cache, setup, get}

function setup (done) {
  cache.proseline.init(done)
}

function get (id, callback) {
  if (cache.hasOwnProperty(id)) return callback(null, cache[id])
  var db = new ProjectDatabase(id)
  cache[id] = db
  db.init(function (error) {
    if (error) {
      delete cache[id]
      return callback(error)
    }
    return callback(null, db)
  })
}
