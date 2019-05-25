/* globals Blob, fetch */
var IndexedDB = require('./db/indexeddb')
var UNTITLED = require('./untitled')
var assert = require('assert')
var crypto = require('@proseline/crypto')
var runParallel = require('run-parallel')
var runSeries = require('run-series')
var saveAs = require('file-saver').saveAs

var treeifyNotes = require('./utilities/treeify-notes')

// TODO: Copy draft to new project.

module.exports = function (initialize, reduction, handler, withIndexedDB) {
  initialize(function () {
    return {
      changed: false,
      peers: 0,
      marks: null,
      notes: null,
      intros: null,
      replyTo: null,
      parents: null,
      draft: null,
      // Project
      identity: null,
      replicationKey: null,
      projectDiscoveryKey: null,
      writeKeyPair: null,
      persistent: null,
      title: null,
      draftSelection: null,
      // Overview
      projects: null,
      userIntro: null,
      // Subscription
      subscription: null
    }
  })

  // Intro

  handler('set user intro', function (data, state, reduce, done) {
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.setIntro(data, function (error) {
        if (error) return done(error)
        reduce('user intro', data)
        done()
      })
    })
  })

  reduction('user intro', function (userIntro, state) {
    return { userIntro }
  })

  handler('introduce', function (data, state, reduce, done) {
    var identity = state.identity
    var userIntro = state.userIntro
    var intro = {
      type: 'intro',
      name: userIntro.name,
      device: userIntro.device,
      timestamp: new Date().toISOString()
    }
    var entry = {
      project: state.projectDiscoveryKey,
      body: intro
    }
    withIndexedDB(state.projectDiscoveryKey, function (error, db) {
      if (error) return done(error)
      db.putIntro(entry, identity, function (error, envelope) {
        if (error) return done(error)
        reduce('project intro', envelope)
        done()
      })
    })
  })

  reduction('project intro', function (newIntro, state) {
    state.intros[newIntro.publicKey] = newIntro
    return {
      intros: state.intros,
      activity: [newIntro].concat(state.activity)
    }
  })

  // Member Activity

  handler('load member', function (data, state, reduce, done) {
    loadMember(data, state, reduce, done)
  })

  reloadHandler('member', loadMember)

  function loadMember (data, setate, reduce, done) {
    assert.strictEqual(typeof data.publicKey, 'string')
    assert.strictEqual(data.publicKey.length, 64)
    var publicKey = data.publicKey
    withIndexedDB(data.projectDiscoveryKey, function (error, db) {
      if (error) return done(error)
      db.memberActivity(publicKey, 100, function (error, activity) {
        if (error) return done(error)
        reduce('member', {
          member: publicKey,
          memberActivity: activity
        })
        done()
      })
    })
  }

  reduction('member', function (data, state) {
    return data
  })

  // Projects

  handler('create project', function (data, state, reduce, done) {
    var title = data.title
    var persistent = data.persistent
    createProject({ title, persistent }, function (error, project) {
      if (error) return done(error)
      redirectToProject(project.projectDiscoveryKey)
      done()
    })
  })

  handler('leave project', function (projectDiscoveryKey, state, reduce, done) {
    assert.strictEqual(typeof projectDiscoveryKey, 'string')
    runParallel([
      function overwriteProject (done) {
        withIndexedDB('proseline', function (error, db) {
          if (error) return done(error)
          db.getProject(projectDiscoveryKey, function (error, project) {
            if (error) return done(error)
            var stub = {
              deleted: true,
              projectDiscoveryKey: project.projectDiscoveryKey,
              replicationKey: project.replicationKey,
              title: project.title,
              writeSeed: project.writeSeed
            }
            db.overwriteProject(stub, done)
          })
        })
      },
      function deleteDatabase (done) {
        IndexedDB.deleteDatabase(projectDiscoveryKey)
        done()
      }
    ], function (error) {
      if (error) return done(error)
      reduce('clear project', null)
      window.history.pushState({}, null, '/')
      done()
    })
  })

  handler('join project', function (data, state, reduce, done) {
    assert.strictEqual(typeof data, 'object')
    assert.strictEqual(typeof data.projectReplicationKey, 'string')
    assert.strictEqual(typeof data.projectReadKey, 'string')
    assert.strictEqual(typeof data.projectWriteSeed, 'string')
    var projectReplicationKey = data.projectReplicationKey
    var projectReadKey = data.projectReadKey
    var projectWriteSeed = data.projectWriteSeed
    var projectDiscoveryKey = hashHex(projectReplicationKey)
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.getProject(projectDiscoveryKey, function (error, project) {
        if (error) return done(error)
        if (project && !project.deleted) return redirect()
        createProject({
          projectReplicationKey,
          projectDiscoveryKey,
          projectReadKey,
          projectWriteSeed,
          // If we are rejoining a project we left, reuse
          // the old title.
          title: data.title
        }, function (error) {
          if (error) return done(error)
          redirect()
        })
      })
    })
    function redirect () {
      loadProject(projectDiscoveryKey, state, reduce, function (error) {
        if (error) return done(error)
        redirectToProject(projectDiscoveryKey)
        done()
      })
    }
  })

  function createProject (data, callback) {
    assert.strictEqual(typeof data, 'object')
    var projectReplicationKey = data.projectReplicationKey
    var projectDiscoveryKey = data.projectDiscoveryKey
    var projectReadKey = data.projectReadKey
    var projectWriteSeed = data.projectWriteSeed
    var title = data.title
    assert.strictEqual(typeof callback, 'function')
    if (projectReplicationKey) {
      assert.strictEqual(typeof projectReplicationKey, 'string')
      assert.strictEqual(typeof projectDiscoveryKey, 'string')
      assert.strictEqual(typeof projectReadKey, 'string')
      assert.strictEqual(typeof projectWriteSeed, 'string')
    } else {
      projectReplicationKey = crypto.makeProjectReplicationKey().toString('hex')
      projectDiscoveryKey = hashHex(projectReplicationKey)
      projectReadKey = crypto.makeProjectReplicationKey().toString('hex')
      projectWriteSeed = crypto.makeSigniningKeyPairSeed().toString('hex')
    }
    var writeKeyPair = crypto.makeSigningKeyPairFromSeed(projectWriteSeed)
    writeKeyPair.publicKey = writeKeyPair.publicKey.toString('hex')
    writeKeyPair.secretKey = writeKeyPair.secretKey.toString('hex')
    var project = {
      projectReplicationKey,
      projectDiscoveryKey,
      projectWriteSeed,
      writeKeyPair,
      title: title || UNTITLED,
      persistent: !!data.persistent
    }
    runSeries([
      function (done) {
        withIndexedDB('proseline', function (error, db) {
          if (error) return done(error)
          db.putProject(project, done)
        })
      },
      function (done) {
        withIndexedDB(projectDiscoveryKey, function (error, db) {
          if (error) return done(error)
          db.createIdentity(true, done)
        })
      }
    ], function (error) {
      if (error) return callback(error)
      callback(null, project)
    })
  }

  function redirectToProject (projectDiscoveryKey) {
    window.history.pushState({}, null, '/projects/' + projectDiscoveryKey)
  }

  handler('rename', function (newTitle, state, reduce, done) {
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.getProject(state.projectDiscoveryKey, function (error, project) {
        if (error) return done(error)
        if (!project) return done(new Error('no project to rename'))
        if (project.deleted) return done(new Error('deleted project'))
        project.title = newTitle
        db.overwriteProject(project, function (error) {
          if (error) return done(error)
          reduce('rename', newTitle)
          done()
        })
      })
    })
  })

  reduction('rename', function (newTitle, state) {
    return { title: newTitle }
  })

  handler('persist', function (_, state, reduce, done) {
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.getProject(state.projectDiscoveryKey, function (error, project) {
        if (error) return done(error)
        if (!project) return done(new Error('no project'))
        if (project.deleted) return done(new Error('deleted project'))
        project.persistent = true
        db.overwriteProject(project, function (error) {
          if (error) return done(error)
          reduce('persistent', true)
          done()
        })
      })
    })
  })

  reduction('persistent', function (persistent, state) {
    return { persistent: persistent }
  })

  // Subscriptions

  handler('subscribe', function (data, state, reduce, done) {
    // TODO: Subscribe API call
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.getUserIdentity(function (error, identity) {
        if (error) return done(error)
        var email = data.email
        var token = data.token
        var date = new Date().toISOString()
        var entry = { token, email, date }
        var order = { entry, publicKey: identity.publicKey }
        crypto.sign(order, identity.projectReplicationKey, 'signature')
        fetch('https://paid.proseline.com/subscribe', {
          method: 'POST',
          mode: 'cors',
          cache: 'no-cache',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          referrer: 'no-referrer',
          body: JSON.stringify(order)
        })
          .then(function (response) { return response.json() })
          .then(function (result) {
            var subscription = { email }
            db.setSubscription(subscription, function (error) {
              if (error) return done(error)
              reduce('subscription', subscription)
              // TODO: Tell Client to reconnect on subscribe.
              done()
            })
          })
          .catch(function (error) { done(error) })
      })
    })
  })

  // Loading

  handler('load projects', function (_, state, reduce, done) {
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      runParallel({
        projects: function (done) {
          db.listProjects(done)
        },
        subscription: function (done) {
          db.getSubscription(done)
        }
      }, function (error, results) {
        if (error) return done(error)
        reduce('projects', results.projects)
        reduce('subscription', results.subscription || {})
        done()
      })
    })
  })

  reduction('projects', function (projects, state) {
    return { projects: projects }
  })

  handler('load project', function (projectDiscoveryKey, state, reduce, done) {
    loadProject(projectDiscoveryKey, state, reduce, done)
  })

  function loadProject (projectDiscoveryKey, state, reduce, done) {
    withIndexedDB(projectDiscoveryKey, function (error, db) {
      if (error) return done(error)
      runParallel({
        project: function (done) {
          withIndexedDB('proseline', function (error, db) {
            if (error) return done(error)
            db.getProject(projectDiscoveryKey, function (error, project) {
              if (error) return done(error)
              if (project.deleted) return done(new Error('deleted project'))
              done(null, project)
            })
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
          db.activity(10, done)
        },
        subscription: function (done) {
          withIndexedDB('proseline', function (error, db) {
            if (error) return done(error)
            db.getSubscription(done)
          })
        },
        userIntro: function (done) {
          withIndexedDB('proseline', function (error, db) {
            if (error) return done(error)
            db.getIntro(done)
          })
        }
      }, function (error, data) {
        if (error) return done(error)
        reduce('project', data)
        done()
      })
    })
  }

  reduction('project', function (data, state) {
    return {
      projects: null,
      changed: false,
      title: data.project.title,
      replicationKey: data.project.replicationKey,
      projectDiscoveryKey: data.project.projectDiscoveryKey,
      writeSeed: data.project.writeSeed,
      writeKeyPair: data.project.writeKeyPair,
      persistent: data.project.persistent,
      identity: data.identity,
      intros: data.intros,
      userIntro: data.userIntro,
      projectMarks: data.projectMarks || [],
      draftBriefs: data.draftBriefs || [],
      activity: data.activity,
      draftSelection: null,
      subscription: data.subscription || {}
    }
  })

  reduction('clear project', function (_, state) {
    return {
      changed: false,
      projectDiscoveryKey: null,
      projects: null,
      draftSelection: null
    }
  })

  handler('load draft', function (data, state, reduce, done) {
    loadDraft(data, state, reduce, done)
  })

  function loadDraft (data, state, reduce, done) {
    var digest = data.digest
    withIndexedDB(data.projectDiscoveryKey, function (error, db) {
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
        },
        comparing: function (done) {
          if (data.comparing) {
            db.getDraft(data.comparing, done)
          } else done()
        }
      }, function (error, results) {
        if (error) return done(error)
        results.draft.digest = digest
        var parents = results.draft.innerEnvelope.entry.parents
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
  }

  reloadHandler('draft', loadDraft)

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
      parents: data.parents || [],
      children: children,
      parent: null,
      parentMarks: null,
      ownMarks: null,
      changes: null,
      draftSelection: null,
      comparing: data.comparing
    }
  })

  handler('load subscription', function (_, state, reduce, done) {
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      db.getSubscription(function (error, subscription) {
        if (error) return done(error)
        reduce('subscription', subscription || {})
        done()
      })
    })
  })

  reduction('subscription', function (subscription, state) {
    return { subscription: subscription }
  })

  handler(
    'add device to subscription',
    function (data, state, reduce, done) {
      assert(data.hasOwnProperty('email'))
      withIndexedDB('proseline', function (error, db) {
        if (error) return done(error)
        db.getUserIdentity(function (error, identity) {
          if (error) return done(error)
          var email = data.email
          var entry = {
            email,
            name: data.name,
            date: new Date().toISOString()
          }
          var request = {
            entry,
            publicKey: identity.publicKey
          }
          crypto.sign(request, identity.secretKey, 'signature')
          fetch('https://paid.proseline.com/add', {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/json' },
            referrer: 'no-referrer',
            body: JSON.stringify(request)
          })
            .then(function (response) {
              var status = response.status
              if (status !== 200) {
                return done(new Error('server responded ' + status))
              }
              return response.json()
            })
            .then(function (body) {
              if (body.error) return done(body.error)
              var subscription = { email }
              db.setSubscription({ email }, function (error) {
                if (error) return done(error)
                reduce('subscription', subscription)
                // TODO: Tell Client to reconnect on subscribe.
                done()
              })
            })
            .catch(function (error) { done(error) })
        })
      })
    }
  )

  handler('load parents', function (data, state, reduce, done) {
    loadParents(data, state, reduce, done)
  })

  reloadHandler('parents', loadParents)

  function loadParents (data, state, reduce, done) {
    assert(data.hasOwnProperty('parentDigests'))
    var parentDigests = data.parentDigests
    assert(Array.isArray(parentDigests))
    assert(parentDigests.length > 0)
    assert(parentDigests.every(function (element) {
      return (
        typeof element === 'string' &&
        element.length === 64
      )
    }))
    withIndexedDB(state.projectDiscoveryKey, function (error, db) {
      if (error) return done(error)
      runParallel(parentDigests.map(function (digest) {
        return function (done) {
          db.getDraft(digest, done)
        }
      }), function (error, parents) {
        if (error) return done(error)
        reduce('parents', parents)
        done()
      })
    })
  }

  reduction('parents', function (parents, state) {
    return { parents }
  })

  handler('load mark', function (data, state, reduce, done) {
    loadMark(data, state, reduce, done)
  })

  reloadHandler('mark', loadMark)

  function loadMark (data, state, reduce, done) {
    assert(data.hasOwnProperty('projectDiscoveryKey'))
    assert(data.hasOwnProperty('publicKey'))
    assert(data.hasOwnProperty('identifier'))
    withIndexedDB(data.projectDiscoveryKey, function (error, db) {
      if (error) return done(error)
      db.markHistory(data.publicKey, data.identifier, 100, function (error, history) {
        if (error) return done(error)
        var latestMark = history[0]
        reduce('mark', {
          markPublicKey: latestMark.publicKey,
          markIdentifier: latestMark.innerEnvelope.entry.identifier,
          mark: latestMark,
          markHistory: history
        })
        done()
      })
    })
  }

  reduction('mark', function (data, state) {
    return data
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
    var entry = {
      project: state.projectDiscoveryKey,
      body: draft
    }
    withIndexedDB(state.projectDiscoveryKey, function (error, db) {
      if (error) return done(error)
      db.putDraft(entry, identity, function (error, envelope, digest) {
        if (error) return done(error)
        reduce('push draft', envelope)
        reduce('push brief', {
          digest: digest,
          project: envelope.entry.project,
          publicKey: identity.publicKey,
          parents: draft.parents,
          timestamp: draft.timestamp
        })
        window.history.pushState(
          {}, null,
          '/projects/' + state.projectDiscoveryKey +
          '/drafts/' + digest
        )
        done()
      })
    })
  })

  reduction('push draft', function (envelope, state) {
    return { activity: [envelope].concat(state.activity) }
  })

  reduction('push brief', function (brief, state) {
    return { draftBriefs: (state.draftBriefs || []).concat(brief) }
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
      return mark.innerEnvelope.entry.identifier
    }
  })

  function putMark (identifier, name, draft, state, callback) {
    identifier = identifier || crypto.randomBuffer(4).toString('hex')
    var identity = state.identity
    var mark = {
      type: 'mark',
      identifier: identifier,
      name: name,
      timestamp: new Date().toISOString(),
      draft: draft
    }
    var entry = {
      project: state.projectDiscoveryKey,
      body: mark
    }
    withIndexedDB(state.projectDiscoveryKey, function (error, db) {
      if (error) return callback(error)
      db.putMark(entry, identity, function (error, envelope) {
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
    var entry = {
      project: state.projectDiscoveryKey,
      body: note
    }
    withIndexedDB(state.projectDiscoveryKey, function (error, db) {
      if (error) return done(error)
      db.putNote(entry, identity, function (error, envelope) {
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
      activity: [newNote].concat(state.activity),
      draftBriefs: state.draftBriefs.map(function (brief) {
        if (brief.digest === newNote.innerEnvelope.entry.draft) {
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
    return { replyTo: parent }
  })

  handler('select draft', function (digest, state, reduce, done) {
    reduce('select draft', digest)
    done()
  })

  reduction('select draft', function (draftSelection, state) {
    return { draftSelection }
  })

  handler('deselect draft', function (digest, state, reduce, done) {
    reduce('deselect draft', digest)
    done()
  })

  reduction('deselect draft', function (digest, state) {
    return { draftSelection: null }
  })

  // Change

  handler('changed', function (parent, state, reduce, done) {
    reduce('changed')
    done()
  })

  reduction('changed', function () {
    return { changed: true }
  })

  handler('peers', function (count, state, reduce, done) {
    reduce('peers', count)
    done()
  })

  reduction('peers', function (count) {
    return { peers: count }
  })

  // Downloads

  // TODO: Download in a word processor format
  handler('download', function (_, state, reduce, done) {
    saveAs(
      new Blob(
        [JSON.stringify(state.draft.innerEnvelope.entry.text)],
        { type: 'application/json;charset=utf-8' }
      ),
      'proseline.json',
      true // Omit BOM.
    )
  })

  handler('backup', function (_, state, reduce, done) {
    withIndexedDB('proseline', function (error, db) {
      if (error) return done(error)
      runParallel({
        projects: function (done) {
          db.listProjects(function (error, projects) {
            if (error) return done(error)
            runParallel(projects.map(function (project) {
              return function (done) {
                if (project.deleted) return done(null, { project })
                withIndexedDB(project.projectDiscoveryKey, function (error, db) {
                  if (error) return done(error)
                  db.getDefaultIdentity(function (error, identity) {
                    if (error) return done(error)
                    done(null, { project, identity })
                  })
                })
              }
            }), done)
          })
        },
        userIdentity: function (done) {
          db.getUserIdentity(done)
        },
        subscription: function (done) {
          db.getSubscription(done)
        }
      }, function (error, results) {
        if (error) return done(error)
        saveAs(
          new Blob(
            [JSON.stringify(results)],
            { type: 'application/json;charset=UTF-8' }
          ),
          'proseline-backup.json'
        )
      })
    })
  })

  // Helper Functions

  function reloadHandler (name, loader) {
    handler('reload ' + name, function (data, state, reduce, done) {
      runParallel([
        function (done) {
          loader(data, state, reduce, done)
        },
        function (done) {
          loadProject(data.projectDiscoveryKey, state, reduce, done)
        }
      ], done)
    })
  }
}

function hashHex (hex) {
  return crypto.hash(Buffer.from(hex, 'hex')).toString('hex')
}
