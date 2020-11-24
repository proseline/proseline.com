/* globals Element */
const Client = require('./net/client')
const Clipboard = require('clipboard')
const IndexedDB = require('./db/indexeddb')
const assert = require('nanoassert')
const beforeUnload = require('./before-unload')
const crypto = require('@proseline/crypto')
const databases = require('./db/databases')
const debug = require('debug')('proseline:instance')
const domainSingleton = require('domain-singleton')
const moment = require('moment')
const pageBus = require('./page-bus')
const runSeries = require('run-series')

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
      const error = new Error('no IndexedDB')
      error.userMessage = 'You must enable IndexedDB in your web browser to use Proseline.'
      done(error)
    }
    done()
  }
}

const EventEmitter = require('events').EventEmitter
const nanomorph = require('nanomorph')
const nanoraf = require('nanoraf')

// State Management

const globalState = {}
window.globalState = globalState

const actions = new EventEmitter()
  .on('error', function (error) {
    console.error(error)
    window.alert(error.toString())
  })

function send (/* variadic */) {
  assert(
    actions.listenerCount(arguments[0]) > 0,
    'no listeners for action ' + arguments[0]
  )
  actions.emit.apply(actions, arguments)
}

const reductions = new EventEmitter()
let initializer

require('./model')(
  function makeInitializer (_initializer) {
    initializer = _initializer
    resetState()
  },
  function makeReduction (name, listener) {
    assert(typeof name === 'string', 'name is a string')
    assert(name.length !== 0, 'name is not empty')
    assert(
      reductions.listenerCount(name) === 0,
      'just one listener for ' + name
    )
    reductions.on(name, function (data) {
      Object.assign(globalState, listener(data, globalState))
    })
  },
  function makeHandler (name, listener) {
    assert(typeof name === 'string', 'name is a string')
    assert(name.length !== 0, 'name is not empty')
    assert(
      actions.listenerCount(name) === 0,
      'just one listener for ' + name
    )
    actions.on(name, nanoraf(function (data) {
      listener(data, globalState, reduce, function (error) {
        if (error) return send('error', error)
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

let timestampInterval

function update () {
  clearInterval(timestampInterval)
  const rerendered = render(globalState)
  // All renderers must return a <main> or the
  // diff algorithm will fail.
  assert(rerendered instanceof Element)
  assert(rerendered.tagName === 'MAIN')
  beforeUnload.disable()
  nanomorph(rendered, rerendered)
  timestampInterval = setInterval(updateTimestamps, 30 * 1000)
}

function resetState () {
  Object.assign(globalState, initializer())
}

const renderComparison = require('./views/comparison')
const renderEditor = require('./views/editor')
const renderHomePage = require('./views/home-page')
const renderLoading = require('./views/loading')
const renderMark = require('./views/mark')
const renderMember = require('./views/member')
const renderNotFound = require('./views/not-found')
const renderProject = require('./views/project')
const renderViewer = require('./views/viewer')
const renderSubscription = require('./views/subscription')

const pathOf = require('./utilities/path-of')

const PEER_COUNT_UPDATE_INTERVAL = 3 * 10000

let rendered

function render (state) {
  const path = pathOf(window.location.href)
  let main
  // Home
  if (path === '' || path === '/') {
    return renderHomePage(state, send)
  // Join Link
  } else if (path === '/join' && window.location.hash) {
    const re = /^#([a-f0-9]{64}):([a-f0-9]{64}):([a-f0-9]{64}):([a-f0-9]{64})$/
    const match = re.exec(window.location.hash)
    if (!match) return renderNotFound(state, send)
    main = document.createElement('main')
    main.appendChild(
      renderLoading(function () {
        send('join project', {
          replicationKey: crypto.hexToBase64(match[1]),
          encryptionKey: crypto.hexToBase64(match[2]),
          projectKeyPair: {
            publicKey: crypto.hexToBase64(match[3]),
            secretKey: crypto.hexToBase64(match[4])
          }
        })
      }, 'Joining…')
    )
    return main
  // /project/{discovery key}
  } else if (/^\/projects\/[a-f0-9]{64}/.test(path)) {
    const discoveryKey = crypto.hexToBase64(path.substr(10, 64))
    const remainder = path.substr(74)
    let logPublicKey
    if (remainder === '' || remainder === '/') {
      return renderProject(state, send, discoveryKey)
    // New Draft
    } else if (remainder === '/drafts/new') {
      return renderEditor(state, send, discoveryKey)
    // New Draft with Parents
    } else if (/^\/drafts\/new\/[a-f0-9]{64}(,[a-f0-9]{64})*$/.test(remainder)) {
      const parents = remainder.substr(12).split(',').map(crypto.hexToBase64)
      return renderEditor(state, send, discoveryKey, parents)
    // Comparison
    } else if (/^\/drafts\/compare\/[a-f0-9]{64},[a-f0-9]{64}$/.test(remainder)) {
      const drafts = remainder.substr(16).split(',').map(crypto.hexToBase64)
      return renderComparison(state, send, discoveryKey, drafts)
    // View Drafts
    } else if (/^\/drafts\/[a-f0-9]{64}$/.test(remainder)) {
      const digest = crypto.hexToBase64(remainder.substr(8, 64))
      return renderViewer(state, send, discoveryKey, digest)
    // Mark
    } else if (/^\/marks\/[a-f0-9]{64}:[a-f0-9]{8}$/.test(remainder)) {
      logPublicKey = crypto.hexToBase64(remainder.substr(7, 64))
      const identifier = crypto.hexToBase64(remainder.substr(7 + 64 + 1, 8))
      return renderMark(state, send, discoveryKey, logPublicKey, identifier)
    // Member Activity
    } else if (/^\/members\/[a-f0-9]{64}$/.test(remainder)) {
      logPublicKey = crypto.hexToBase64(remainder.substr(9, 64))
      return renderMember(state, send, discoveryKey, logPublicKey)
    } else {
      return renderNotFound(state, send)
    }
  } else if (path === '/subscription') {
    return renderSubscription(state, send)
  } else {
    return renderNotFound(state, send)
  }
}

function network (done) {
  domainSingleton({
    bus: pageBus,
    task: 'proseline-peer',
    onAppointed: function () {
      debug('appointed peer')
      const client = new Client()
      setInterval(function () {
        pageBus.emit('peers', client.countPeers())
      }, PEER_COUNT_UPDATE_INTERVAL)
    }
  })
  pageBus.on('peers', function (count) {
    // TODO: Prevent clearing inputs on redraw.
    // send('peers', count)
  })
  pageBus.on('entry', function (entry) {
    // If we created this entry, don't show an update.
    if (entry.local) return
    const discoveryKey = entry.discoveryKey
    if (
      globalState.discoveryKey &&
      globalState.discoveryKey === discoveryKey
    ) return send('changed')
    if (
      !globalState.discoveryKey &&
      !globalState.projects.some(function (project) {
        return project.discoveryKey === discoveryKey
      })
    ) return send('changed')
  })
  /*
  pageBus.on('added project', function (x) {
    if (!globalState.discoveryKey) {
      console.log('changed bc added project')
      return send('changed')
    }
  })
  */
  done()
}

function launchApplication (done) {
  rendered = render(globalState)
  document.body.appendChild(rendered)
  done()
}

// History

// Trap hyperlinks.

const findLocalLinkAnchor = require('./utilities/find-local-link-anchor')

window.addEventListener('click', function (event) {
  if (event.which === 2) return
  const node = findLocalLinkAnchor(event.target)
  if (node) {
    event.preventDefault()
    let href = node.href
    if (href.baseVal) href = href.baseVal
    if (
      beforeUnload.isEnabled() &&
      !window.confirm(beforeUnload.message)
    ) return
    window.history.pushState({}, null, pathOf(href) || '/')
    update()
    setTimeout(function () {
      const match = /#([a-f0-9]{64})$/.exec(href)
      if (match) {
        const anchor = document.getElementById(match[1])
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
  const elements = document.getElementsByClassName('relativeTimestamp')
  for (let index = 0; index < elements.length; index++) {
    const element = elements[index]
    const timestamp = element.dataset.timestamp
    if (timestamp) {
      element.innerText = moment(timestamp).fromNow()
    }
  }
}
