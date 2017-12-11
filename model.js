var assert = require('assert')
var diff = require('diff/lib/diff/line').diffLines
var runParallel = require('run-parallel')
var runSeries = require('run-series')
var stringify = require('json-stable-stringify')

var hash = require('./crypto/hash')
var hashHex = require('./crypto/hash-hex')
var random = require('./crypto/random')
var sign = require('./crypto/sign')
var treeifyNotes = require('./utilities/treeify-notes')

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
    withIndexedDB(data.discoveryKey, function (error, db) {
      if (error) return done(error)
      db.putIntro(identity.publicKey, envelope, function (error) {
        if (error) return done(error)
        reduce('increment head', 1)
        reduce('intro', envelope)
        done()
      })
    })
  })

  reduction('increment head', function (count, state) {
    return {head: state.head + count}
  })

  reduction('intro', function (newIntro, state) {
    return {intro: newIntro}
  })

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
          results.head = head
          reduce('project', results)
          done()
        })
      })
    })
  })

  reduction('project', function (data, state) {
    return {
      title: data.project.title,
      discoveryKey: data.project.discoveryKey,
      secretKey: data.project.secretKey,
      identity: data.identity,
      head: data.head
    }
  })

  handler('load draft', function (data, state, reduce, done) {
    var digest = data.digest
    withIndexedDB(data.discoveryKey, function (error, db) {
      if (error) return done(error)
      runParallel({
        draft: function (done) {
          db.getDraft(digest, done)
        },
        marks: function (done) {
          db.getMarks(digest, done)
        },
        notes: function (done) {
          db.getNotes(digest, done)
        },
        children: function (done) {
          db.getChildren(digest, done)
        }
      }, function (error, results) {
        if (error) return done(error)
        results.draft.digest = digest
        var parents = results.draft.entry.payload.parents
        runParallel(parents.map(function (digest) {
          return function (done) {
            db.getDraft(digest, function (error, parent) {
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
              db.getIntro(publicKey, done)
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
            state.draft.entry.payload.text,
            state.children[data.index].entry.payload.text
          )
          : diff(
            state.parents[data.index].entry.payload.text,
            state.draft.entry.payload.text
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

  handler('load parent', function (data, state, reduce, done) {
    withIndexedDB(state.discoveryKey, function (error, db) {
      if (error) return done(error)
      db.getDraft(data.digest, function (error, draft) {
        if (error) return done(error)
        draft.digest = data.digest
        reduce('parent', draft)
        done()
      })
    })
  })

  reduction('parent', function (data, state) {
    return {parent: data}
  })

  handler('load mark', function (data, state, reduce, done) {
    assert(data.hasOwnProperty('discoveryKey'))
    assert(data.hasOwnProperty('publicKey'))
    assert(data.hasOwnProperty('identifier'))
    withIndexedDB(data.discoveryKey, function (error, db) {
      if (error) return done(error)
      db.getMark(data.publicKey, data.identifier, function (error, mark) {
        if (error) return done(error)
        // TODO: Handle mark not found.
        window.history.replaceState(
          {}, null,
          '/projects/' + data.discoveryKey +
          '/drafts/' + mark.entry.payload.draft
        )
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
    withIndexedDB(state.discoveryKey, function (error, db) {
      if (error) return done(error)
      db.putDraft(digest, envelope, function (error) {
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
                '/projects/' + state.discoveryKey +
                '/marks/' + identity.publicKey + ':' + mark.entry.payload.identifier
              )
              done()
            }
          )
        } else {
          window.history.pushState(
            {}, null,
            '/projects/' + state.discoveryKey +
            '/drafts/' + digest
          )
          done()
        }
      })
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
    withIndexedDB(state.discoveryKey, function (error, db) {
      if (error) return callback(error)
      db.putMark(identity.publicKey, identifier, envelope, function (error) {
        if (error) return callback(error)
        callback(null, envelope)
      })
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
    withIndexedDB(state.discoveryKey, function (error, db) {
      if (error) return done(error)
      db.putNote(digest, envelope, function (error) {
        if (error) return done(error)
        reduce('increment head', 1)
        reduce('push note', envelope)
        done()
      })
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
}
