var IndexedDB = require('./db/indexeddb')
var assert = require('assert')
var diff = require('diff/lib/diff/line').diffLines
var peer = require('./net/peer')
var runParallel = require('run-parallel')
var runSeries = require('run-series')

var hashHex = require('./crypto/hash-hex')
var random = require('./crypto/random')
var treeifyNotes = require('./utilities/treeify-notes')

var DEFAULT_TITLE = 'Untitled Project'

module.exports = function (initialize, reduction, handler, withIndexedDB) {
  initialize(function () {
    return {
      changed: false,
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
      // Overview
      projects: null
    }
  })

  // Intro

  handler('introduce', function (data, state, reduce, done) {
    var identity = state.identity
    var intro = {
      type: 'intro',
      name: data.name,
      device: data.device,
      timestamp: new Date().toISOString()
    }
    var message = {
      project: state.discoveryKey,
      body: intro
    }
    withIndexedDB(state.discoveryKey, function (error, db) {
      if (error) return done(error)
      db.putIntro(message, identity, function (error, envelope) {
        if (error) return done(error)
        reduce('intro', envelope)
        done()
      })
    })
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

  handler('delete project', function (discoveryKey, state, reduce, done) {
    assert.equal(typeof discoveryKey, 'string')
    runParallel([
      function deleteProject (done) {
        withIndexedDB('proseline', function (error, db) {
          if (error) return done(error)
          db.deleteProject(discoveryKey, done)
        })
      },
      function deleteDatabase (done) {
        IndexedDB.deleteDatabase(discoveryKey)
        done()
      }
    ], function (error) {
      if (error) return done(error)
      reduce('clear project', null)
      window.history.pushState({}, null, '/')
      done()
    })
  })

  handler('join project', function (secretKey, state, reduce, done) {
    assert.equal(typeof secretKey, 'string')
    var discoveryKey = hashHex(secretKey)
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.getProject(discoveryKey, function (error, project) {
        if (error) return done(error)
        if (project) return redirect()
        createProject(secretKey, discoveryKey, DEFAULT_TITLE, function (error) {
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
    assert.equal(typeof title, 'string')
    assert.equal(typeof callback, 'function')
    if (secretKey) {
      assert.equal(typeof secretKey, 'string')
      assert.equal(typeof discoveryKey, 'string')
    } else {
      secretKey = random(32)
      discoveryKey = hashHex(secretKey)
    }
    var project = {
      secretKey: secretKey,
      discoveryKey: discoveryKey,
      title: title
    }
    assert.equal(typeof secretKey, 'string')
    assert.equal(typeof discoveryKey, 'string')
    assert.equal(typeof project.secretKey, 'string')
    assert.equal(typeof project.discoveryKey, 'string')
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
      withIndexedDB(discoveryKey, function (error, db) {
        if (error) return callback(error)
        peer.joinSwarm(project, db)
        callback(null, project)
      })
    })
  }

  function redirectToProject (discoveryKey) {
    window.history.pushState({}, null, '/projects/' + discoveryKey)
  }

  reduction('new project', function (newProject, state) {
    return {projects: state.projects.concat(newProject)}
  })

  handler('rename', function (newTitle, state, reduce, done) {
    var project = {
      secretKey: state.secretKey,
      discoveryKey: state.discoveryKey,
      title: newTitle
    }
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.putProject(project, done)
      reduce('rename', project)
    })
  })

  reduction('rename', function (newProject, state) {
    return {
      title: newProject.title,
      projects: state.projects.map(function (oldProject) {
        if (oldProject.discoveryKey === newProject.discoveryKey) {
          return newProject
        } else {
          return oldProject
        }
      })
    }
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
    withIndexedDB(discoveryKey, function (error, db) {
      if (error) return done(error)
      runParallel({
        project: function (done) {
          withIndexedDB('proseline', function (error, db) {
            if (error) return done(error)
            db.getProject(discoveryKey, done)
          })
        },
        identity: function (done) {
          db.getDefaultIdentity(done)
        },
        projectMarks: function (done) {
          db.listMarks(done)
        },
        draftBriefs: function (done) {
          db.listDraftBriefs(done)
        },
        intros: function (done) {
          db.listIntros(function (error, intros) {
            if (error) return done(error)
            var result = {}
            intros.forEach(function (intro) {
              result[intro.publicKey] = intro
            })
            done(null, result)
          })
        }
      }, function (error, results) {
        if (error) return done(error)
        var publicKey = results.identity.publicKey
        db.getIntro(publicKey, function (error, intro) {
          if (error) return done(error)
          results.intro = intro
          reduce('project', results)
          done()
        })
      })
    })
  })

  reduction('project', function (data, state) {
    return {
      changed: false,
      title: data.project.title,
      discoveryKey: data.project.discoveryKey,
      secretKey: data.project.secretKey,
      identity: data.identity,
      intro: data.intro,
      intros: data.intros,
      projectMarks: data.projectMarks || [],
      draftBriefs: data.draftBriefs || []
    }
  })

  reduction('clear project', function (_, state) {
    return {
      changed: false,
      discoveryKey: null,
      projects: null
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
        var parents = results.draft.message.body.parents
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
            state.draft.message.body.text,
            state.children[data.index].message.body.text
          )
          : diff(
            state.parents[data.index].message.body.text,
            state.draft.message.body.text
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
          '/drafts/' + mark.message.body.draft
        )
        done()
      })
    })
  })

  // Drafts

  handler('save', function (data, state, reduce, done) {
    var identity = state.identity
    var draft = {
      type: 'draft',
      parents: data.parents,
      text: data.text,
      timestamp: new Date().toISOString()
    }
    var message = {
      project: state.discoveryKey,
      body: draft
    }
    withIndexedDB(state.discoveryKey, function (error, db) {
      if (error) return done(error)
      db.putDraft(message, identity, function (error, envelope, digest) {
        if (error) return done(error)
        reduce('push brief', {
          digest: digest,
          publicKey: identity.publicKey,
          parents: draft.parents,
          timestamp: draft.timestamp
        })
        if (data.mark) {
          var mark = data.mark
          putMark(
            null, mark, digest, state,
            function (error, mark) {
              if (error) return done(error)
              reduce('push mark', mark)
              window.history.pushState(
                {}, null,
                '/projects/' + state.discoveryKey +
                '/marks/' + identity.publicKey + ':' + mark.message.body.identifier
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

  reduction('push brief', function (brief, state) {
    return {draftBriefs: (state.draftBriefs || []).concat(brief)}
  })

  // Marks

  handler('mark', function (name, state, reduce, done) {
    putMark(
      null, name, state.draft.digest, state,
      function (error, mark) {
        if (error) return done(error)
        reduce('push mark', mark)
        done()
      }
    )
  })

  reduction('push mark', function (mark, state) {
    return {
      marks: state.marks
        ? state.marks.concat(mark)
        : [mark],
      projectMarks: state.projectMarks
        ? state.projectMarks.concat(mark)
        : [mark]
    }
  })

  function putMark (identifier, name, draft, state, callback) {
    identifier = identifier || random(4)
    var identity = state.identity
    var mark = {
      type: 'mark',
      identifier: identifier,
      name: name,
      timestamp: new Date().toISOString(),
      draft: draft
    }
    var message = {
      project: state.discoveryKey,
      body: mark
    }
    withIndexedDB(state.discoveryKey, function (error, db) {
      if (error) return callback(error)
      db.putMark(message, identity, function (error, envelope) {
        if (error) return callback(error)
        callback(null, envelope)
      })
    })
  }

  // Notes

  handler('note', function (data, state, reduce, done) {
    var identity = state.identity
    var note = {
      type: 'note',
      draft: state.draft.digest,
      parent: data.parent,
      text: data.text,
      timestamp: new Date().toISOString()
    }
    var message = {
      project: state.discoveryKey,
      body: note
    }
    withIndexedDB(state.discoveryKey, function (error, db) {
      if (error) return done(error)
      db.putNote(message, identity, function (error, envelope) {
        if (error) return done(error)
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

  // Change

  reduction('changed', function () {
    return {changed: true}
  })
}
