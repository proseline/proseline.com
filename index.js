var createIdentity = require('./crypto/create-identity')
var runSeries = require('run-series')

runSeries([
  detectFeatures,
  setupIdentity,
  launchApplication,
  function (error) {
    if (error) {
      throw error
    }
  }
])

var indexedDB

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

var identity

function setupIdentity (done) {
  loadDefaultIdentity(function (error, loaded) {
    if (error) return done(error)
    if (loaded === undefined) {
      writeIdentity(done)
    } else {
      identity = loaded
      done()
    }
  })

  function loadDefaultIdentity (done) {
    withIndexedDB(function (error, db) {
      if (error) return done(error)
      var transaction = db.transaction(['identities'], 'readonly')
      transaction.oncomplete = function () {
        done(null, loaded)
      }
      transaction.onerror = function () {
        done(transaction.error)
      }
      var store = transaction.objectStore('identities')
      var getRequest = store.get('default')
      var loaded
      getRequest.onsuccess = function () {
        loaded = getRequest.result
      }
    })
  }

  function writeIdentity (done) {
    identity = createIdentity()
    withIndexedDB(function (error, db) {
      if (error) return done(error)
      var transaction = db.transaction(['identities'], 'readwrite')
      transaction.oncomplete = function () {
        done()
      }
      transaction.onerror = function () {
        done(transaction.error)
      }
      var store = transaction.objectStore('identities')
      store.put(identity, 'default')
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
    db.createObjectStore('introductions')
    // Drafts
    var drafts = db.createObjectStore('drafts')
    drafts.createIndex('parents', 'parents', {
      unique: false,
      multiEntry: true
    })
    // Notes
    var notes = db.createObjectStore('notes')
    notes.createIndex('draft', ['payload', 'draft'], {unique: false})
    notes.createIndex('parents', ['payload', 'parents'], {
      unique: false,
      multiEntry: true
    })
    // Markers
    var markers = db.createObjectStore('markers')
    markers.createIndex('public', ['payload', 'public'], {unique: false})
  }
  request.onerror = function () {
    callback(request.error)
  }
}

function launchApplication (done) {
  // TODO
}
