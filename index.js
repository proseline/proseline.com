var IndexedDB = require('./db/indexeddb')
var assert = require('assert')
var peer = require('./net/peer')
var runParallel = require('run-parallel')
var runSeries = require('run-series')

runSeries([
  detectFeatures,
  setupDatabase,
  joinSwarms,
  launchApplication
], function (error) {
  if (error) throw error
})

function detectFeatures (done) {
  runSeries([
    detectIndexedDB
  ], done)

  function detectIndexedDB (done) {
    if (!IndexedDB) {
      var error = new Error('no IndexedDB')
      error.userMessage = 'You must enable IndexedDB in your web browser to use Proseline.'
      done(error)
    }
    done()
  }
}

var ProjectDatabase = require('./db/project')
var ProselineDatabase = require('./db/proseline')

var databases = {
  proseline: new ProselineDatabase()
}

function setupDatabase (done) {
  databases.proseline.init(done)
}

var EventEmitter = require('events').EventEmitter
var nanomorph = require('nanomorph')
var nanoraf = require('nanoraf')

// State Management

var state = {}

var actions = new EventEmitter()
  .on('error', function (error) {
    console.error(error)
    window.alert(error.toString())
  })

function action (/* variadic */) {
  assert(
    actions.listenerCount(arguments[0]) > 0,
    'not listeners for action ' + arguments[0]
  )
  actions.emit.apply(actions, arguments)
}

var reductions = new EventEmitter()
var initializer

require('./model')(
  function initialize (_initializer) {
    initializer = _initializer
    resetState()
  },
  function reduce (event, handler) {
    assert.equal(typeof event, 'string', 'event is a string')
    assert(event.length !== 0, 'event is not empty')
    assert.equal(
      reductions.listenerCount(event), 0,
      'just one listener for ' + event
    )
    reductions.on(event, function (data) {
      Object.assign(state, handler(data, state))
    })
  },
  function handle (event, handler) {
    assert.equal(typeof event, 'string', 'event is a string')
    assert(event.length !== 0, 'event is not empty')
    assert.equal(
      actions.listenerCount(event), 0,
      'just one listener for ' + event
    )
    actions.on(event, nanoraf(function (data) {
      handler(data, state, send, callback)
      function callback (error) {
        if (error) {
          console.error(error)
          action('error', error)
        }
        update()
      }
    }))
  },
  withDatabase
)

function send (event, data) {
  assert(
    reductions.listenerCount(event) > 0,
    'no listeners for ' + event
  )
  reductions.emit(event, data)
}

function withDatabase (id, callback) {
  if (databases.hasOwnProperty(id)) {
    callback(null, databases[id])
  } else {
    var db = new ProjectDatabase(id)
    db.on('change', function () {
      if (state.discoveryKey === id) {
        send('changed')
      }
    })
    databases[id] = db
    db.init(function (error) {
      if (error) {
        delete databases[id]
        callback(error)
      } else {
        callback(null, db)
      }
    })
  }
}

function update () {
  nanomorph(rendered, render())
}

function resetState () {
  Object.assign(state, initializer())
}

var renderEditor = require('./views/editor')
var renderLoading = require('./views/loading')
var renderNotFound = require('./views/not-found')
var renderHomePage = require('./views/home-page')
var renderProject = require('./views/project')
var renderViewer = require('./views/viewer')

var pathOf = require('./utilities/path-of')

var rendered

function render () {
  var path = pathOf(window.location.href)
  // Home
  if (path === '' || path === '/') {
    return renderHomePage(state, action)
  // Join Link
  } else if (/^\/join\/[a-f0-9]{64}$/.test(path)) {
    return renderLoading(function () {
      action('join project', /[a-f0-9]{64}$/.exec(path)[0])
    })
  // /project/{discovery key}
  } else if (/^\/projects\/[a-f0-9]{64}/.test(path)) {
    var discoveryKey = path.substr(10, 64)
    var remainder = path.substr(74)
    if (remainder === '' || remainder === '/') {
      return renderProject(state, action, discoveryKey)
    // New Draft
    } else if (remainder === '/drafts/new') {
      return renderEditor(state, action, discoveryKey)
    // New Draft with Parent
    } else if (/^\/drafts\/new\/[a-f0-9]{64}$/.test(remainder)) {
      var parent = remainder.substr(12, 64)
      return renderEditor(state, action, discoveryKey, parent)
    // View Drafts
    } else if (/^\/drafts\/[a-f0-9]{64}$/.test(remainder)) {
      var digest = remainder.substr(8, 64)
      return renderViewer(state, action, discoveryKey, digest)
    // Mark
    } else if (/^\/marks\/[a-f0-9]{64}:[a-f0-9]{8}$/.test(remainder)) {
      return renderLoading(function () {
        action('load mark', {
          discoveryKey: discoveryKey,
          publicKey: remainder.substr(7, 64),
          identifier: remainder.substr(7 + 64 + 1, 8)
        })
      })
    } else {
      return renderNotFound(state, action)
    }
  } else {
    return renderNotFound(state, action)
  }
}

function joinSwarms (done) {
  databases.proseline.listProjects(function (error, projects) {
    if (error) return done(error)
    runParallel(
      projects.map(function (project) {
        return function (done) {
          withDatabase(project.discoveryKey, function (error, database) {
            if (error) return done(error)
            peer.joinSwarm(project, database)
            done()
          })
        }
      }),
      done
    )
  })
}

function launchApplication (done) {
  rendered = render()
  document.body.appendChild(rendered)
  done()
}

// History

// Trap hyperlinks.

var findLocalLinkAnchor = require('./utilities/find-local-link-anchor')

window.addEventListener('click', function (event) {
  if (event.which === 2) return
  var node = findLocalLinkAnchor(event.target)
  if (node) {
    event.preventDefault()
    window.history.pushState({}, null, pathOf(node.href) || '/')
    update()
  }
})

window.addEventListener('popstate', update)

window.databases = databases
