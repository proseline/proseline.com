const ProjectDatabase = require('./project')
const ProselineDatabase = require('./proseline')
const debug = require('debug')('proseline:databases')
const has = require('has')

// Initialize the main proseline database immediately.
// This database stores information on other project databases.
const proseline = new ProselineDatabase()

// A cache of Database instances, stored by name.
const cache = { proseline }

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
  if (has(cache, id)) {
    const cached = cache[id]
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
    const db = new ProjectDatabase({
      discoveryKey: id,
      encryptionKey: project.encryptionKey,
      projectKeyPair: project.projectKeyPair
    })
    cache[id] = db
    debug('initializing "' + id + '"')
    let errored = false
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
