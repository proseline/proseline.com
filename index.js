var IndexedDB = require('./db/indexeddb')
var assert = require('assert')
var runSeries = require('run-series')

runSeries([
  detectFeatures,
  setupDatabase,
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
      function send (event, data) {
        assert(
          reductions.listenerCount(event) > 0,
          'no listeners for ' + event
        )
        reductions.emit(event, data)
      }
      function callback (error) {
        if (error) {
          console.error(error)
          action('error', error)
        }
        update()
      }
    }))
  },
  function withDatabase (id, callback) {
    if (databases.hasOwnProperty(id)) {
      callback(null, databases[id])
    } else {
      var db = new ProjectDatabase(id)
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
)

function update () {
  nanomorph(rendered, render())
}

function resetState () {
  Object.assign(state, initializer())
}

var renderEditor = require('./views/editor')
var renderLoading = require('./views/loading')
var renderNotFound = require('./views/not-found')
var renderOverview = require('./views/overview')
var renderProject = require('./views/project/view')
var renderProjectCreator = require('./views/project/create')
var renderProjectJoin = require('./views/project/join')
var renderViewer = require('./views/viewer')

var pathOf = require('./utilities/path-of')

var rendered

function render () {
  var path = pathOf(window.location.href)
  if (path === '' || path === '/') {
    return renderOverview(state, action)
  } else if (/^\/[a-f0-9]{64}$/.test(path)) {
    return renderProjectJoin(state, action, path.substring(1))
  } else if (startsWith('/projects/new')) {
    return renderProjectCreator(state, action)
  } else if (startsWith('/projects/')) {
    return renderProject(state, action, path.substring(10))
  } else if (startsWith('/drafts/new/')) {
    return renderEditor(state, action, path.substring(12))
  } else if (startsWith('/drafts/new')) {
    return renderEditor(state, action)
  } else if (startsWith('/drafts/')) {
    return renderViewer(path.substring(8), state, action)
  } else if (startsWith('/marks/')) {
    return renderLoading(function () {
      action('load mark', path.substring(7))
    })
  } else {
    return renderNotFound(state, action)
  }

  function startsWith (prefix) {
    return path.indexOf(prefix) === 0
  }
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
