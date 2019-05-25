var ProjectDatabase = require('./project')
var ProselineDatabase = require('./proseline')
var debug = require('debug')('proseline:databases')

// Initialize the main proseline database immediately.
// This database stores information on other project databases.
var proseline = new ProselineDatabase()

// A cache of Database instances, stored by name.
var cache = { proseline }

module.exports = { proseline, setup, get }

// Export function to set up the main proseline database,
// so that the application can ensure it's loaded before rendering.
function setup (done) {
  debug('initializing "proseline"')
  cache.proseline.init(done)
}

// As each IndexedDB is requested, create a Database instance for it and
// cache the instance.
function get (id, callback) {
  // If cached...
  if (cache.hasOwnProperty(id)) {
    var cached = cache[id]
    if (cached.ready) return callback(null, cached)
    cached.once('ready', function () {
      callback(null, cached)
    })
  }
  // Otherwise...
  proseline.getProject(id, function (error, project) {
    if (error) return callback(error)
    if (project && project.deleted) {
      return callback(new Error('deleted project'))
    }
    var db = new ProjectDatabase({
      projectDiscoveryKey: id,
      projectReadKey: project.projectReadKey,
      projectWriteKeyPair: project.projectWriteKeyPair
    })
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
  })
}
