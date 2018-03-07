/* globals Element */
var Clipboard = require('clipboard')
var IndexedDB = require('./db/indexeddb')
var assert = require('assert')
var moment = require('moment')
var peer = require('./net/peer')
var runParallel = require('run-parallel')
var runSeries = require('run-series')
var selectedRange = require('./utilities/selected-range')

var debug = {
  textSelection: require('debug')('proseline:text-selection')
}

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

var globalState = {}

var actions = new EventEmitter()
  .on('error', function (error) {
    console.error(error)
    window.alert(error.toString())
  })

function action (/* variadic */) {
  assert(
    actions.listenerCount(arguments[0]) > 0,
    'no listeners for action ' + arguments[0]
  )
  actions.emit.apply(actions, arguments)
}

var reductions = new EventEmitter()
var initializer

require('./model')(
  function makeInitializer (_initializer) {
    initializer = _initializer
    resetState()
  },
  function makeReduction (name, listener) {
    assert.equal(typeof name, 'string', 'name is a string')
    assert(name.length !== 0, 'name is not empty')
    assert.equal(
      reductions.listenerCount(name), 0,
      'just one listener for ' + name
    )
    reductions.on(name, function (data) {
      Object.assign(globalState, listener(data, globalState))
    })
  },
  function makeHandler (name, listener) {
    assert.equal(typeof name, 'string', 'name is a string')
    assert(name.length !== 0, 'name is not empty')
    assert.equal(
      actions.listenerCount(name), 0,
      'just one listener for ' + name
    )
    actions.on(name, nanoraf(function (data) {
      listener(data, globalState, reduce, function (error) {
        if (error) return action('error', error)
        update()
      })
    }))
  },
  withDatabase
)

function reduce (event, data) {
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
      if (globalState.discoveryKey === id) action('changed')
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

var timestampInterval

function update () {
  clearInterval(timestampInterval)
  var rerendered = render(globalState)
  // All renderers must return a <main> or the
  // diff algorithm will fail.
  assert(rerendered instanceof Element)
  assert.equal(rerendered.tagName, 'MAIN')
  nanomorph(rendered, rerendered)
  timestampInterval = setInterval(updateTimestamps, 30 * 1000)
}

function resetState () {
  Object.assign(globalState, initializer())
}

var renderEditor = require('./views/editor')
var renderHomePage = require('./views/home-page')
var renderLoading = require('./views/loading')
var renderMember = require('./views/member')
var renderNotFound = require('./views/not-found')
var renderProject = require('./views/project')
var renderViewer = require('./views/viewer')

var pathOf = require('./utilities/path-of')

var rendered

function render (state) {
  var path = pathOf(window.location.href)
  var main
  // Home
  if (path === '' || path === '/') {
    return renderHomePage(state, action)
  // Join Link
  } else if (/^\/join\/[a-f0-9]{64}$/.test(path)) {
    var secretKey = path.substr(6, 64)
    main = document.createElement('main')
    main.appendChild(
      renderLoading(function () {
        action('join project', secretKey)
      }, 'Joining…')
    )
    return main
  // /project/{discovery key}
  } else if (/^\/projects\/[a-f0-9]{64}/.test(path)) {
    var discoveryKey = path.substr(10, 64)
    var remainder = path.substr(74)
    if (remainder === '' || remainder === '/') {
      return renderProject(state, action, discoveryKey)
    // New Draft
    } else if (remainder === '/drafts/new') {
      return renderEditor(state, action, discoveryKey)
    // New Draft with Parents
    } else if (/^\/drafts\/new\/[a-f0-9]{64}(,[a-f0-9]{64})*$/.test(remainder)) {
      var parents = remainder.substr(12).split(',')
      return renderEditor(state, action, discoveryKey, parents)
    // View Drafts
    } else if (/^\/drafts\/[a-f0-9]{64}$/.test(remainder)) {
      var digest = remainder.substr(8, 64)
      return renderViewer(state, action, discoveryKey, digest)
    // Mark
    } else if (/^\/marks\/[a-f0-9]{64}:[a-f0-9]{8}$/.test(remainder)) {
      main = document.createElement('main')
      main.appendChild(
        renderLoading(function () {
          action('load mark', {
            discoveryKey: discoveryKey,
            publicKey: remainder.substr(7, 64),
            identifier: remainder.substr(7 + 64 + 1, 8)
          })
        })
      )
      return main
    // Member Activity
    } else if (/^\/members\/[a-f0-9]{64}$/.test(remainder)) {
      var publicKey = remainder.substr(9, 64)
      return renderMember(state, action, discoveryKey, publicKey)
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
  peer.events
    .on('connect', onPeersChange)
    .on('disconnect', onPeersChange)
  function onPeersChange () {
    action('peers', peer.countPeers())
  }
}

function launchApplication (done) {
  rendered = render(globalState)
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
    setTimeout(function () {
      var match = /#([a-f0-9]{64})$/.exec(node.href)
      if (match) {
        var anchor = document.getElementById(match[1])
        if (anchor) {
          anchor.scrollIntoView()
        }
      }
    }, 100)
  }
})

window.addEventListener('popstate', update)

// Configure Copy-to-Clipboard Links

new Clipboard('.clipboard')
  .on('success', function (event) {
    window.alert('Copied to clipboard.')
    event.clearSelection()
  })

window.databases = databases

// Timestamps

function updateTimestamps () {
  var elements = document.getElementsByClassName('relativeTimestamp')
  for (var index = 0; index < elements.length; index++) {
    var element = elements[index]
    var timestamp = element.dataset.timestamp
    if (timestamp) {
      element.innerText = moment(timestamp).fromNow()
    }
  }
}

document.addEventListener('mouseup', function () {
  var range = selectedRange('draftText')
  if (range) {
    debug.textSelection('range: %o', range)
    action('select', range)
  }
})
