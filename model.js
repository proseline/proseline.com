var diff = require('diff/lib/diff/line').diffLines
var runParallel = require('run-parallel')
var runSeries = require('run-series')
var stringify = require('json-stable-stringify')

var hash = require('./crypto/hash')
var hashHex = require('./crypto/hash-hex')
var random = require('./crypto/random')
var sign = require('./crypto/sign')
var treeifyNotes = require('./utilities/treeify-notes')

var getChildren = require('./queries/children')
var getMarks = require('./queries/marks')
var getNotes = require('./queries/notes')

module.exports = function (initialize, reduction, handler, withIndexedDB) {
  initialize(function () {
    return {
      intro: null,
      marks: null,
      notes: null,
      intros: null,
      replyTo: null,
      parent: null,
      draft: null,
      // Project
      identity: null,
      secretKey: null,
      discoveryKey: null,
      title: null,
      head: null,
      // Overview
      projects: null
    }
  })

  // Intro

  handler('introduce', function (data, state, reduce, done) {
    var identity = state.identity
    var intro = {
      name: data.name,
      device: data.device,
      timestamp: new Date().toISOString()
    }
    var entry = {
      project: state.discoveryKey,
      index: state.head,
      payload: intro
    }
    var stringified = stringify(entry)
    var envelope = {
      entry: entry,
      publicKey: identity.publicKey,
      signature: sign(stringified, identity.secretKey)
    }
    put('intros', identity.publicKey, envelope, function (error) {
      if (error) return done(error)
      reduce('increment head', 1)
      reduce('intro', envelope)
      done()
    })
  })

  reduction('increment head', function (count, state) {
    return {head: state.head + count}
  })

  reduction('intro', function (newIntro, state) {
    return {intro: newIntro}
  })

  handler('identity name', function (newName, state, reduce, done) {
    updateIdentity('name', newName, state, reduce, done)
  })

  handler('identity device', function (newDevice, state, reduce, done) {
    updateIdentity('device', newDevice, state, reduce, done)
  })

  reduction('identity', function (newIdentity, state) {
    return {identity: newIdentity}
  })

  function updateIdentity (key, value, state, reduce, done) {
    var changes = {}
    changes[key] = value
    var newIdentity = Object.assign({}, state.identity, changes)
    put('identities', newIdentity.publicKey, newIdentity, function (error) {
      if (error) return done(error)
      reduce('identity', newIdentity)
      done()
    })
  }

  // Projects

  handler('create project', function (data, state, reduce, done) {
    createProject(null, null, data.title, function (error, project) {
      if (error) return done(error)
      reduce('new project', project)
      redirectToProject(project.discoveryKey)
      done()
    })
  })

  handler('join project', function (secretKey, state, reduce, done) {
    var discoveryKey = hashHex(secretKey)
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.getProject(discoveryKey, function (error, project) {
        if (error) return done(error)
        if (project) return redirect()
        createProject(secretKey, discoveryKey, function (error) {
          if (error) return done(error)
          redirect()
        })
      })
    })
    function redirect () {
      redirectToProject(discoveryKey)
      done()
    }
  })

  function createProject (secretKey, discoveryKey, title, callback) {
    secretKey = secretKey || random(32)
    discoveryKey = discoveryKey || hashHex(secretKey)
    var project = {
      secretKey: secretKey,
      discoveryKey: discoveryKey,
      title: title || 'Untitled Project'
    }
    runSeries([
      function (done) {
        withIndexedDB('proseline', function (error, db) {
          if (error) return done(error)
          db.putProject(project, done)
        })
      },
      function (done) {
        withIndexedDB(discoveryKey, function (error, db) {
          if (error) return done(error)
          db.createIdentity(true, done)
        })
      }
    ], function (error) {
      if (error) return callback(error)
      callback(null, project)
    })
  }

  function redirectToProject (discoveryKey) {
    window.history.pushState({}, null, '/projects/' + discoveryKey)
  }

  reduction('new project', function (newProject, state) {
    return {projects: state.projects.concat(newProject)}
  })

  // Loading

  handler('load projects', function (_, state, reduce, done) {
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.listProjects(function (error, projects) {
        if (error) return done(error)
        reduce('projects', projects)
        done()
      })
    })
  })

  reduction('projects', function (projects, state) {
    return {projects: projects}
  })

  handler('load project', function (discoveryKey, state, reduce, done) {
    runParallel({
      project: function (done) {
        withIndexedDB('proseline', function (error, db) {
          if (error) return done(error)
          db.getProject(discoveryKey, done)
        })
      },
      identity: function (done) {
        withIndexedDB(discoveryKey, function (error, db) {
          if (error) return done(error)
          db.getDefaultIdentity(done)
        })
      }
    }, function (error, results) {
      if (error) return done(error)
      withIndexedDB(discoveryKey, function (error, db) {
        if (error) return done(error)
        db.getLogHead(results.identity.publicKey, function (error, head) {
          if (error) return done(error)
          reduce('project', results.project)
          reduce('identity', results.identity)
          reduce('head', head)
          done()
        })
      })
    })
  })

  reduction('project', function (newProject, state) {
    return {
      title: newProject.title,
      discoveryKey: newProject.discoveryKey,
      secretKey: newProject.secretKey
    }
  })

  handler('load draft', function (digest, state, reduce, done) {
    withIndexedDB(function (error, db) {
      if (error) return done(error)
      runParallel({
        draft: function (done) {
          get(db, 'drafts', digest, done)
        },
        marks: function (done) {
          getMarks(db, digest, done)
        },
        notes: function (done) {
          getNotes(db, digest, done)
        },
        children: function (done) {
          withIndexedDB(function (error, db) {
            if (error) return done(error)
            getChildren(db, digest, done)
          })
        }
      }, function (error, results) {
        if (error) return done(error)
        results.draft.digest = digest
        var parents = results.draft.payload.parents
        runParallel(parents.map(function (digest) {
          return function (done) {
            get(db, 'drafts', digest, function (error, parent) {
              if (error) return done(error)
              parent.digest = digest
              done(null, parent)
            })
          }
        }), function (error, parents) {
          if (error) return done(error)
          results.parents = parents
          // Get intros for all relevant public keys.
          var publicKeys = [results.draft.publicKey]
          results.marks.forEach(addPublicKey)
          results.notes.forEach(addPublicKey)
          results.parents.forEach(addPublicKey)
          results.children.forEach(addPublicKey)
          function addPublicKey (object) {
            var publicKey = object.publicKey
            if (!publicKeys.includes(publicKey)) {
              publicKeys.push(publicKey)
            }
          }
          var introsTasks = {}
          publicKeys.forEach(function (publicKey) {
            introsTasks[publicKey] = function (done) {
              get(db, 'intros', publicKey, done)
            }
          })
          runParallel(introsTasks, function (error, intros) {
            if (error) return done(error)
            results.intros = intros
            reduce('draft', results)
            done()
          })
        })
      })
    })
  })

  reduction('draft', function (data, state) {
    var children = data.children || []
    var notes = data.notes || []
    return {
      draft: data.draft,
      intro: data.intro || null,
      marks: data.marks || [],
      notes: notes,
      notesTree: treeifyNotes(notes),
      intros: data.intros || {},
      replyTo: null,
      parents: data.parents || [],
      children: children,
      diff: null,
      parent: null,
      ownMarks: null
    }
  })

  handler('diff', function (data, state, reduce, done) {
    reduce('diff', {
      source: data.source,
      index: data.index,
      changes: splitChanges(
        data.source === 'children'
          ? diff(
            state.draft.payload.text,
            state.children[data.index].payload.text
          )
          : diff(
            state.parents[data.index].payload.text,
            state.draft.payload.text
          )
      )
    })
    done()
  })

  function splitChanges (changes) {
    var returned = []
    changes.forEach(function (change) {
      change.value
        .split('\n')
        .forEach(function (line) {
          var newChange = {value: line}
          newChange.added = change.added
          newChange.removed = change.removed
          returned.push(newChange)
        })
    })
    return returned
  }

  handler('stop diffing', function (_, state, reduce, done) {
    reduce('diff', null)
    done()
  })

  reduction('diff', function (diff, state) {
    return {diff: diff}
  })

  handler('load parent', function (digest, state, reduce, done) {
    withIndexedDB(function (error, db) {
      if (error) return done(error)
      get(db, 'drafts', digest, function (error, draft) {
        if (error) return done(error)
        draft.digest = digest
        reduce('parent', draft)
        done()
      })
    })
  })

  reduction('parent', function (data, state) {
    return {parent: data}
  })

  handler('load mark', function (key, state, reduce, done) {
    withIndexedDB(function (error, db) {
      if (error) return done(error)
      get(db, 'marks', key, function (error, mark) {
        if (error) return done(error)
        // TODO: Handle mark not found.
        window.history.replaceState({}, null, '/drafts/' + mark.payload.draft)
        done()
      })
    })
  })

  // Drafts

  handler('save', function (data, state, reduce, done) {
    var identity = state.identity
    var draft = {
      parents: data.parents,
      text: data.text,
      timestamp: new Date().toISOString()
    }
    var entry = {
      project: state.discoveryKey,
      index: state.head,
      payload: draft
    }
    var stringified = stringify(entry)
    var envelope = {
      entry: entry,
      publicKey: identity.publicKey,
      signature: sign(stringified, identity.secretKey)
    }
    var digest = hash(stringified)
    put('drafts', digest, envelope, function (error) {
      if (error) return done(error)
      reduce('increment head', 1)
      if (data.mark) {
        var mark = data.mark
        putMark(
          null, mark, digest, state,
          function (error, mark) {
            if (error) return done(error)
            reduce('increment head', 1)
            window.history.pushState(
              {}, null,
              '/marks/' + identity.publicKey + ':' + mark.payload.identifier
            )
            done()
          }
        )
      } else {
        window.history.pushState({}, null, '/drafts/' + digest)
        done()
      }
    })
  })

  // Marks

  handler('mark', function (name, state, reduce, done) {
    putMark(
      null, name, state.draft.digest, state,
      function (error, mark) {
        if (error) return done(error)
        reduce('increment head', 1)
        reduce('push mark', mark)
        done()
      }
    )
  })

  reduction('push mark', function (mark, state) {
    return {marks: state.marks.concat(mark)}
  })

  function putMark (identifier, name, draft, state, callback) {
    identifier = identifier || random(4)
    var identity = state.identity
    var mark = {
      identifier: identifier,
      name: name,
      timestamp: new Date().toISOString(),
      draft: draft
    }
    var entry = {
      project: state.discoveryKey,
      index: state.head,
      payload: mark
    }
    var stringified = stringify(entry)
    var envelope = {
      entry: entry,
      publicKey: identity.publicKey,
      signature: sign(stringified, identity.secretKey)
    }
    var key = identity.publicKey + ':' + identifier
    put('marks', key, envelope, function (error) {
      if (error) return callback(error)
      callback(null, envelope)
    })
  }

  // Notes

  handler('note', function (data, state, reduce, done) {
    var identity = state.identity
    var note = {
      draft: state.draft.digest,
      parent: data.parent,
      text: data.text,
      timestamp: new Date().toISOString()
    }
    var entry = {
      project: state.discoveryKey,
      index: state.head,
      payload: note
    }
    var stringified = stringify(entry)
    var envelope = {
      payload: entry,
      publicKey: identity.publicKey,
      signature: sign(stringified, identity.secretKey)
    }
    var digest = hash(stringified)
    put('notes', digest, envelope, function (error) {
      if (error) return done(error)
      reduce('increment head', 1)
      reduce('push note', envelope)
      done()
    })
  })

  reduction('push note', function (newNote, state) {
    var notes = state.notes.concat(newNote)
    return {
      notes: notes,
      notesTree: treeifyNotes(notes),
      replyTo: null
    }
  })

  handler('reply to', function (parent, state, reduce, done) {
    reduce('reply to', parent)
    done()
  })

  reduction('reply to', function (parent, state) {
    return {replyTo: parent}
  })

  // IndexedDB Helper

  function put (store, key, value, callback) {
    withIndexedDB(function (error, db) {
      if (error) return callback(error)
      var transaction = db.transaction([store], 'readwrite')
      transaction.oncomplete = function () {
        callback()
      }
      transaction.onerror = function () {
        callback(transaction.error)
      }
      var objectStore = transaction.objectStore(store)
      objectStore.put(value, key)
    })
  }

  function get (db, store, key, callback) {
    var transaction = db.transaction([store], 'readonly')
    transaction.onerror = function () {
      callback(transaction.error)
    }
    var objectStore = transaction.objectStore(store)
    var request = objectStore.get(key)
    request.onsuccess = function () {
      callback(null, request.result)
    }
  }
}
