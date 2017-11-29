var assert = require('assert')
var createIdentity = require('./crypto/create-identity')
var runSeries = require('run-series')
var getLatestIntro = require('./queries/latest-introduction')

runSeries([
  detectFeatures,
  setupIdentity,
  launchApplication
], function (error) {
  if (error) throw error
})

var indexedDB
var state = {
  identity: null
}

function detectFeatures (done) {
  runSeries([
    detectIndexedDB
  ], done)

  function detectIndexedDB (done) {
    indexedDB = (
      window.indexedDB ||
      window.mozIndexedDB ||
      window.webkitIndexedDB ||
      window.msIndexedDB
    )
    if (!indexedDB) {
      var error = new Error('no IndexedDB')
      error.userMessage = 'You must enable IndexedDB in your web browser to use Proseline.'
      done(error)
    }
    done()
  }
}

function setupIdentity (done) {
  loadDefaultIdentity(function (error, identity, intro) {
    if (error) return done(error)
    if (identity === undefined) {
      writeIdentity(done)
    } else {
      state.identity = identity
      if (intro) {
        state.introduction = intro
      }
      done()
    }
  })

  function loadDefaultIdentity (done) {
    withIndexedDB(function (error, db) {
      if (error) return done(error)
      getIdentity('default', function (error, publicKey) {
        if (error) return done(error)
        if (publicKey === undefined) {
          done()
        } else {
          getIdentity(publicKey, function (error, identity) {
            if (error) return done(error)
            getLatestIntro(db, identity.publicKey, function (error, intro) {
              if (error || intro === undefined) {
                done(null, identity)
              } else {
                done(null, identity, intro)
              }
            })
          })
        }
      })

      function getIdentity (key, callback) {
        var transaction = db.transaction(['identities'], 'readonly')
        transaction.onerror = function () {
          callback(transaction.error)
        }
        var store = transaction.objectStore('identities')
        var request = store.get(key)
        request.onsuccess = function () {
          callback(null, request.result)
        }
      }
    })
  }

  function writeIdentity (done) {
    var identity = createIdentity()
    withIndexedDB(function (error, db) {
      if (error) return done(error)
      var transaction = db.transaction(['identities'], 'readwrite')
      transaction.oncomplete = function () {
        state.identity = identity
        done()
      }
      transaction.onerror = function () {
        done(transaction.error)
      }
      var store = transaction.objectStore('identities')
      store.put(identity.publicKey, 'default')
      store.put(identity, identity.publicKey)
    })
  }
}

function withIndexedDB (callback) {
  var request = indexedDB.open('proseline')
  request.onsuccess = function () {
    callback(null, request.result)
  }
  request.onupgradeneeded = function () {
    var db = request.result
    // Identities
    db.createObjectStore('identities')
    // Introductions
    var introductions = db.createObjectStore('introductions')
    introductions.createIndex('public', 'public', {unique: false})
    // Drafts
    var drafts = db.createObjectStore('drafts')
    drafts.createIndex('parents', 'payload.parents', {
      unique: false,
      multiEntry: true
    })
    // Notes
    var notes = db.createObjectStore('notes')
    notes.createIndex('draft', 'payload.draft', {unique: false})
    notes.createIndex('parents', 'payload.parents', {
      unique: false,
      multiEntry: true
    })
    // Marks
    var marks = db.createObjectStore('marks')
    marks.createIndex('public', 'public', {unique: false})
    marks.createIndex('draft', 'payload.draft', {unique: false})
  }
  request.onerror = function () {
    callback(request.error)
  }
}

var EventEmitter = require('events').EventEmitter
var nanomorph = require('nanomorph')
var nanoraf = require('nanoraf')

function update () {
  nanomorph(rendered, render())
}

// State Management

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
  withIndexedDB
)

function resetState () {
  Object.assign(state, initializer())
}

var renderEditor = require('./views/editor')
var renderLoading = require('./views/loading')
var renderNotFound = require('./views/not-found')
var renderOverview = require('./views/overview')
var renderViewer = require('./views/viewer')

var pathOf = require('./utilities/path-of')

var rendered

function render () {
  var path = pathOf(window.location.href)
  if (path === '' || path === '/') {
    return renderOverview(state, action)
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
    window.history.pushState({}, null, pathOf(node.href))
    update()
  }
})

window.addEventListener('popstate', update)
