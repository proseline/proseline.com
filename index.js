/* globals Element */
var Client = require('./net/client')
var Clipboard = require('clipboard')
var IndexedDB = require('./db/indexeddb')
var assert = require('assert')
var databases = require('./db/databases')
var domainSingleton = require('domain-singleton')
var moment = require('moment')
var pageBus = require('./page-bus')
var runSeries = require('run-series')

var debug = {
  instance: require('debug')('proseline:instance')
}

runSeries([
  detectFeatures,
  databases.setup,
  network,
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
  databases.get
)

function reduce (event, data) {
  assert(
    reductions.listenerCount(event) > 0,
    'no listeners for ' + event
  )
  reductions.emit(event, data)
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

var renderComparison = require('./views/comparison')
var renderEditor = require('./views/editor')
var renderHomePage = require('./views/home-page')
var renderLoading = require('./views/loading')
var renderMark = require('./views/mark')
var renderMember = require('./views/member')
var renderNotFound = require('./views/not-found')
var renderProject = require('./views/project')
var renderViewer = require('./views/viewer')
var renderSubscription = require('./views/subscription')

var pathOf = require('./utilities/path-of')

var rendered

function render (state) {
  var path = pathOf(window.location.href)
  var main
  // Home
  if (path === '' || path === '/') {
    return renderHomePage(state, action)
  // Join Link
  } else if (path === '/join' && window.location.hash) {
    var re = /^#([a-f0-9]{64}):([a-f0-9]{64})$/
    var match = re.exec(window.location.hash)
    if (!match) return renderNotFound(state, action)
    main = document.createElement('main')
    main.appendChild(
      renderLoading(function () {
        action('join project', {
          replicationKey: match[1],
          writeSeed: match[2]
        })
      }, 'Joining…')
    )
    return main
  // /project/{discovery key}
  } else if (/^\/projects\/[a-f0-9]{64}/.test(path)) {
    var discoveryKey = path.substr(10, 64)
    var remainder = path.substr(74)
    var publicKey
    if (remainder === '' || remainder === '/') {
      return renderProject(state, action, discoveryKey)
    // New Draft
    } else if (remainder === '/drafts/new') {
      return renderEditor(state, action, discoveryKey)
    // New Draft with Parents
    } else if (/^\/drafts\/new\/[a-f0-9]{64}(,[a-f0-9]{64})*$/.test(remainder)) {
      var parents = remainder.substr(12).split(',')
      return renderEditor(state, action, discoveryKey, parents)
    // Comparison
    } else if (/^\/drafts\/compare\/[a-f0-9]{64},[a-f0-9]{64}$/.test(remainder)) {
      var drafts = remainder.substr(16).split(',')
      return renderComparison(state, action, discoveryKey, drafts)
    // View Drafts
    } else if (/^\/drafts\/[a-f0-9]{64}$/.test(remainder)) {
      var digest = remainder.substr(8, 64)
      return renderViewer(state, action, discoveryKey, digest)
    // Mark
    } else if (/^\/marks\/[a-f0-9]{64}:[a-f0-9]{8}$/.test(remainder)) {
      publicKey = remainder.substr(7, 64)
      var identifier = remainder.substr(7 + 64 + 1, 8)
      return renderMark(state, action, discoveryKey, publicKey, identifier)
    // Member Activity
    } else if (/^\/members\/[a-f0-9]{64}$/.test(remainder)) {
      publicKey = remainder.substr(9, 64)
      return renderMember(state, action, discoveryKey, publicKey)
    } else {
      return renderNotFound(state, action)
    }
  } else if (path === '/subscription') {
    return renderSubscription(state, action)
  } else {
    return renderNotFound(state, action)
  }
}

var PEER_COUNT_UPDATE_INTERVAL = 3 * 10000

function network (done) {
  domainSingleton({
    bus: pageBus,
    task: 'proseline-peer',
    onAppointed: function () {
      debug.instance('appointed peer')
      var client = new Client()
      setInterval(function () {
        pageBus.emit('peers', client.countPeers())
      }, PEER_COUNT_UPDATE_INTERVAL)
    }
  })
  pageBus.on('peers', function (count) {
    // TODO: Prevent clearing inputs on redraw.
    // action('peers', count)
  })
  pageBus.on('envelope', function (envelope) {
    var discoveryKey = envelope.message.project
    if (
      globalState.discoveryKey === discoveryKey &&
      // Don't render updates while introducing.
      globalState.intros[globalState.identity.publicKey]
    ) {
      action('changed')
    } else if (
      !globalState.discoveryKey &&
      !globalState.projects.some(function (project) {
        return project.discoveryKey === discoveryKey
      })
    ) {
      action('changed')
    }
  })
  done()
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
    var href = node.href
    if (href.baseVal) href = href.baseVal
    window.history.pushState({}, null, pathOf(href) || '/')
    update()
    setTimeout(function () {
      var match = /#([a-f0-9]{64})$/.exec(href)
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
