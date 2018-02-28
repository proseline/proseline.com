/* globals Blob */
var IndexedDB = require('./db/indexeddb')
var assert = require('assert')
var diff = require('diff/lib/diff/line').diffLines
var saveAs = require('file-saver').saveAs
var peer = require('./net/peer')
var runParallel = require('run-parallel')
var runSeries = require('run-series')

var hashHex = require('./crypto/hash-hex')
var random = require('./crypto/random')
var treeifyNotes = require('./utilities/treeify-notes')

var DEFAULT_TITLE = 'Nameless Project'

module.exports = function (initialize, reduction, handler, withIndexedDB) {
  initialize(function () {
    return {
      changed: false,
      marks: null,
      notes: null,
      intros: null,
      replyTo: null,
      selection: null,
      parent: null,
      parentMarks: null,
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
    state.intros[newIntro.publicKey] = newIntro
    return {
      intros: state.intros,
      activity: [newIntro].concat(state.activity)
    }
  })

  // Projects

  handler('create project', function (data, state, reduce, done) {
    createProject(null, null, function (error, project) {
      if (error) return done(error)
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
      peer.leaveSwarm(discoveryKey)
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
        createProject(secretKey, discoveryKey, function (error) {
          if (error) return done(error)
          redirect()
        })
      })
    })
    function redirect () {
      loadProjectData(discoveryKey, function (error, data) {
        if (error) return done(error)
        reduce('project', data)
        redirectToProject(discoveryKey)
        done()
      })
    }
  })

  function createProject (secretKey, discoveryKey, callback) {
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
      title: DEFAULT_TITLE
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

  handler('rename', function (newTitle, state, reduce, done) {
    var project = {
      secretKey: state.secretKey,
      discoveryKey: state.discoveryKey,
      title: newTitle
    }
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.putProject(project, done)
      reduce('rename', newTitle)
    })
  })

  reduction('rename', function (newTitle, state) {
    return {title: newTitle}
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
    loadProjectData(discoveryKey, function (error, data) {
      if (error) return done(error)
      reduce('project', data)
      done()
    })
  })

  function loadProjectData (discoveryKey, callback) {
    withIndexedDB(discoveryKey, function (error, db) {
      if (error) return callback(error)
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
        },
        activity: function (done) {
          db.activity(20, done)
        }
      }, callback)
    })
  }

  reduction('project', function (data, state) {
    return {
      projects: null,
      changed: false,
      title: data.project.title,
      discoveryKey: data.project.discoveryKey,
      secretKey: data.project.secretKey,
      identity: data.identity,
      intros: data.intros,
      projectMarks: data.projectMarks || [],
      draftBriefs: data.draftBriefs || [],
      activity: data.activity
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
          reduce('draft', results)
          done()
        })
      })
    })
  })

  reduction('draft', function (data, state) {
    var children = data.children || []
    var notes = data.notes || []
    return {
      projects: null,
      draft: data.draft,
      marks: data.marks || [],
      notes: notes,
      notesTree: treeifyNotes(notes),
      replyTo: null,
      selection: null,
      parents: data.parents || [],
      children: children,
      diff: null,
      parent: null,
      parentMarks: null,
      ownMarks: null,
      changes: null
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
      runParallel({
        parent: function (done) {
          db.getDraft(data.digest, done)
        },
        parentMarks: function (done) {
          db.getMarks(data.digest, done)
        }
      }, function (error, results) {
        if (error) return done(error)
        reduce('parent', results)
        done()
      })
    })
  })

  reduction('parent', function (data, state) {
    return {
      parent: data.parent,
      parentMarks: data.parentMarks
    }
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
      text: data.text.replace(/\r?\n/g, '\n'),
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
        reduce('push draft', envelope)
        reduce('push brief', {
          digest: digest,
          project: envelope.message.project,
          publicKey: identity.publicKey,
          parents: draft.parents,
          timestamp: draft.timestamp
        })
        if (data.mark) {
          var mark = data.mark
          putMark(
            mark.identifier, mark.name, digest, state,
            function (error, mark) {
              if (error) return done(error)
              reduce('push mark', mark)
              window.history.pushState(
                {}, null,
                '/projects/' + state.discoveryKey +
                '/marks/' + identity.publicKey +
                ':' + mark.message.body.identifier
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

  reduction('push draft', function (envelope, state) {
    return {activity: [envelope].concat(state.activity)}
  })

  reduction('push brief', function (brief, state) {
    return {draftBriefs: (state.draftBriefs || []).concat(brief)}
  })

  // Marks

  handler('mark', function (data, state, reduce, done) {
    putMark(
      data.identifier, data.name, state.draft.digest, state,
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
        ? replacingPriorMarks(mark, state.marks)
        : [mark],
      projectMarks: state.projectMarks
        ? replacingPriorMarks(mark, state.projectMarks)
        : [mark],
      activity: [mark].concat(state.activity)
    }
    function replacingPriorMarks (newMark, oldMarks) {
      return [newMark]
        .concat(oldMarks.filter(function (oldMark) {
          return !(
            oldMark.publicKey === newMark.publicKey &&
            identifierOf(oldMark) === identifierOf(newMark)
          )
        }))
    }
    function identifierOf (mark) {
      return mark.message.body.identifier
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
      text: data.text,
      timestamp: new Date().toISOString()
    }
    if (data.parent) note.parent = data.parent
    else if (data.range) note.range = data.range
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
      replyTo: null,
      selection: null,
      activity: [newNote].concat(state.activity),
      draftBriefs: state.draftBriefs.map(function (brief) {
        if (brief.digest === newNote.message.body.draft) {
          brief.notesCount++
        }
        return brief
      })
    }
  })

  handler('reply to', function (parent, state, reduce, done) {
    reduce('reply to', parent)
    done()
  })

  reduction('reply to', function (parent, state) {
    return {
      replyTo: parent,
      selection: null
    }
  })

  handler('select', function (data, state, reduce, done) {
    reduce('selection', data)
    done()
  })

  reduction('selection', function (data, state) {
    return {selection: data}
  })

  // Change

  handler('changed', function (parent, state, reduce, done) {
    reduce('changed')
    done()
  })

  reduction('changed', function () {
    return {changed: true}
  })

  // Downloads

  handler('download', function (_, state, reduce, done) {
    saveAs(
      new Blob(
        [state.draft.message.body.text],
        {type: 'text/plain;charset=utf-8'}
      ),
      'proseline.md'
    )
  })

  handler('backup', function (_, state, reduce, done) {
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.listProjects(function (error, projects) {
        if (error) return done(error)
        runParallel(
          projects.map(function (project) {
            return function (done) {
              withIndexedDB(project.discoveryKey, function (error, db) {
                if (error) return done(error)
                db.getDefaultIdentity(function (error, identity) {
                  if (error) return done(error)
                  done(null, {project, identity})
                })
              })
            }
          }),
          function (error, results) {
            if (error) return done(error)
            saveAs(
              new Blob(
                [JSON.stringify(results)],
                {type: 'application/json;charset=UTF-8'}
              ),
              'proseline.json'
            )
          }
        )
      })
    })
  })
}
