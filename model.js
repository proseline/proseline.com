/* globals Blob, fetch */
const IndexedDB = require('./db/indexeddb')
const UNTITLED = require('./untitled')
const assert = require('nanoassert')
const crypto = require('@proseline/crypto')
const has = require('has')
const runParallel = require('run-parallel')
const runSeries = require('run-series')
const saveAs = require('file-saver').saveAs

const treeifyNotes = require('./utilities/treeify-notes')

// TODO: Copy draft to new project.

module.exports = (initialize, reduction, handler, withIndexedDB) => {
  initialize(() => {
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
      logKeyPair: null,
      replicationKey: null,
      discoveryKey: null,
      encryptionKey: null,
      projectKeyPair: null,
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

  handler('set user intro', (data, state, reduce, done) => {
    withIndexedDB('proseline', (error, db) => {
      if (error) return done(error)
      db.setIntro(data, error => {
        if (error) return done(error)
        reduce('user intro', data)
        done()
      })
    })
  })

  reduction('user intro', (userIntro, state) => {
    return { userIntro }
  })

  handler('introduce', (data, state, reduce, done) => {
    const logKeyPair = state.logKeyPair
    const userIntro = state.userIntro
    const entry = {
      type: 'intro',
      name: userIntro.name,
      device: userIntro.device,
      timestamp: new Date().toISOString()
    }
    withIndexedDB(state.discoveryKey, (error, db) => {
      if (error) return done(error)
      db.putIntro(entry, logKeyPair, (error, entry) => {
        if (error) return done(error)
        reduce('project intro', entry)
        done()
      })
    })
  })

  reduction('project intro', (newIntro, state) => {
    state.intros[newIntro.envelope.logPublicKey] = newIntro
    return {
      intros: state.intros,
      activity: [newIntro].concat(state.activity)
    }
  })

  // Member Activity

  handler('load member', (data, state, reduce, done) => {
    loadMember(data, state, reduce, done)
  })

  reloadHandler('member', loadMember)

  function loadMember (data, setate, reduce, done) {
    assert(typeof data.logPublicKey === 'string')
    assert(data.logPublicKey.length === 64)
    const logPublicKey = data.logPublicKey
    withIndexedDB(data.discoveryKey, (error, db) => {
      if (error) return done(error)
      db.memberActivity(logPublicKey, 100, (error, activity) => {
        if (error) return done(error)
        reduce('member', {
          member: logPublicKey,
          memberActivity: activity
        })
        done()
      })
    })
  }

  reduction('member', (data, state) => {
    return data
  })

  // Projects

  handler('create project', (data, state, reduce, done) => {
    const title = data.title
    const persistent = data.persistent
    createProject({ title, persistent }, (error, project) => {
      if (error) return done(error)
      redirectToProject(project.discoveryKey)
      done()
    })
  })

  handler('leave project', (discoveryKey, state, reduce, done) => {
    assert(typeof discoveryKey === 'string')
    runParallel([
      function overwriteProject (done) {
        withIndexedDB('proseline', (error, db) => {
          if (error) return done(error)
          db.getProject(discoveryKey, (error, project) => {
            if (error) return done(error)
            const stub = {
              deleted: true,
              discoveryKey: project.discoveryKey,
              replicationKey: project.replicationKey,
              title: project.title,
              projectKeyPair: project.projectKeyPair
            }
            db.overwriteProject(stub, done)
          })
        })
      },
      function deleteDatabase (done) {
        IndexedDB.deleteDatabase(discoveryKey)
        done()
      }
    ], error => {
      if (error) return done(error)
      reduce('clear project', null)
      window.history.pushState({}, null, '/')
      done()
    })
  })

  handler('join project', (data, state, reduce, done) => {
    assert(typeof data === 'object')
    assert(typeof data.replicationKey === 'string')
    assert(typeof data.encryptionKey === 'string')
    assert(typeof data.projectKeyPair === 'string')
    const replicationKey = data.replicationKey
    const encryptionKey = data.encryptionKey
    const projectKeyPair = data.projectKeyPair
    const discoveryKey = crypto.discoveryKey(replicationKey)
    withIndexedDB('proseline', (error, db) => {
      if (error) return done(error)
      db.getProject(discoveryKey, (error, project) => {
        if (error) return done(error)
        if (project && !project.deleted) return redirect()
        createProject({
          replicationKey,
          discoveryKey,
          encryptionKey,
          projectKeyPair,
          // If we are rejoining a project we left, reuse
          // the old title.
          title: data.title
        }, error => {
          if (error) return done(error)
          redirect()
        })
      })
    })
    function redirect () {
      loadProject(discoveryKey, state, reduce, error => {
        if (error) return done(error)
        redirectToProject(discoveryKey)
        done()
      })
    }
  })

  function createProject (data, callback) {
    assert(typeof data === 'object')
    let replicationKey = data.replicationKey
    let discoveryKey = data.discoveryKey
    let encryptionKey = data.encryptionKey
    let projectKeyPair = data.projectKeyPair
    const title = data.title
    assert(typeof callback === 'function')
    if (replicationKey) {
      assert(typeof replicationKey === 'string')
      assert(typeof discoveryKey === 'string')
      assert(typeof encryptionKey === 'string')
      assert(typeof projectKeyPair === 'object')
    } else {
      replicationKey = crypto.replicationKey()
      discoveryKey = crypto.hash(replicationKey)
      encryptionKey = crypto.replicationKey()
      projectKeyPair = crypto.keyPair()
    }
    const project = {
      replicationKey,
      discoveryKey,
      encryptionKey,
      projectKeyPair,
      title: title || UNTITLED,
      persistent: !!data.persistent
    }
    runSeries([
      done => {
        withIndexedDB('proseline', (error, db) => {
          if (error) return done(error)
          db.putProject(project, done)
        })
      },
      done => {
        withIndexedDB(discoveryKey, (error, db) => {
          if (error) return done(error)
          db.createLogKeyPair(true, done)
        })
      }
    ], error => {
      if (error) return callback(error)
      callback(null, project)
    })
  }

  function redirectToProject (discoveryKey) {
    window.history.pushState({}, null, '/projects/' + crypto.base64ToHex(discoveryKey))
  }

  handler('rename', (newTitle, state, reduce, done) => {
    withIndexedDB('proseline', (error, db) => {
      if (error) return done(error)
      db.getProject(state.discoveryKey, (error, project) => {
        if (error) return done(error)
        if (!project) return done(new Error('no project to rename'))
        if (project.deleted) return done(new Error('deleted project'))
        project.title = newTitle
        db.overwriteProject(project, error => {
          if (error) return done(error)
          reduce('rename', newTitle)
          done()
        })
      })
    })
  })

  reduction('rename', (newTitle, state) => {
    return { title: newTitle }
  })

  handler('persist', (_, state, reduce, done) => {
    withIndexedDB('proseline', (error, db) => {
      if (error) return done(error)
      db.getProject(state.discoveryKey, (error, project) => {
        if (error) return done(error)
        if (!project) return done(new Error('no project'))
        if (project.deleted) return done(new Error('deleted project'))
        project.persistent = true
        db.overwriteProject(project, error => {
          if (error) return done(error)
          reduce('persistent', true)
          done()
        })
      })
    })
  })

  reduction('persistent', (persistent, state) => {
    return { persistent: persistent }
  })

  // Subscriptions

  handler('subscribe', (data, state, reduce, done) => {
    // TODO: Subscribe API call
    withIndexedDB('proseline', (error, db) => {
      if (error) return done(error)
      db.getClientKeyPair((error, clientKeyPair) => {
        if (error) return done(error)
        const email = data.email
        const token = data.token
        const date = new Date().toISOString()
        const entry = { token, email, date }
        const order = {
          entry,
          clientPublicKey: clientKeyPair.publicKey,
          signature: crypto.signJSON(entry, clientKeyPair.secretKey)
        }
        fetch('https://paid.proseline.com/subscribe', {
          method: 'POST',
          mode: 'cors',
          cache: 'no-cache',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          referrer: 'no-referrer',
          body: JSON.stringify(order)
        })
          .then(response => response.json())
          .then(result => {
            const subscription = { email }
            db.setSubscription(subscription, error => {
              if (error) return done(error)
              reduce('subscription', subscription)
              // TODO: Tell Client to reconnect on subscribe.
              done()
            })
          })
          .catch(error => { done(error) })
      })
    })
  })

  // Loading

  handler('load projects', (_, state, reduce, done) => {
    withIndexedDB('proseline', (error, db) => {
      if (error) return done(error)
      runParallel({
        projects: done => {
          db.listProjects(done)
        },
        subscription: done => {
          db.getSubscription(done)
        }
      }, (error, results) => {
        if (error) return done(error)
        reduce('projects', results.projects)
        reduce('subscription', results.subscription || {})
        done()
      })
    })
  })

  reduction('projects', (projects, state) => {
    return { projects: projects }
  })

  handler('load project', (discoveryKey, state, reduce, done) => {
    loadProject(discoveryKey, state, reduce, done)
  })

  function loadProject (discoveryKey, state, reduce, done) {
    withIndexedDB(discoveryKey, (error, db) => {
      if (error) return done(error)
      runParallel({
        project: done => {
          withIndexedDB('proseline', (error, db) => {
            if (error) return done(error)
            db.getProject(discoveryKey, (error, project) => {
              if (error) return done(error)
              if (project.deleted) return done(new Error('deleted project'))
              done(null, project)
            })
          })
        },
        logKeyPair: done => {
          db.getDefaultLogKeyPair(done)
        },
        projectMarks: done => {
          db.listMarks(done)
        },
        draftBriefs: done => {
          db.listDraftBriefs(done)
        },
        intros: done => {
          db.listIntros((error, intros) => {
            if (error) return done(error)
            const result = {}
            intros.forEach(intro => {
              result[intro.envelope.logPublicKey] = intro
            })
            done(null, result)
          })
        },
        activity: done => {
          db.activity(10, done)
        },
        subscription: done => {
          withIndexedDB('proseline', (error, db) => {
            if (error) return done(error)
            db.getSubscription(done)
          })
        },
        userIntro: done => {
          withIndexedDB('proseline', (error, db) => {
            if (error) return done(error)
            db.getIntro(done)
          })
        }
      }, (error, data) => {
        if (error) return done(error)
        reduce('project', data)
        done()
      })
    })
  }

  reduction('project', (data, state) => {
    return {
      projects: null,
      changed: false,
      title: data.project.title,
      replicationKey: data.project.replicationKey,
      discoveryKey: data.project.discoveryKey,
      encryptionKey: data.project.encryptionKey,
      projectKeyPair: data.project.projectKeyPair,
      persistent: data.project.persistent,
      logKeyPair: data.logKeyPair,
      intros: data.intros,
      userIntro: data.userIntro,
      projectMarks: data.projectMarks || [],
      draftBriefs: data.draftBriefs || [],
      activity: data.activity,
      draftSelection: null,
      subscription: data.subscription || {}
    }
  })

  reduction('clear project', (_, state) => {
    return {
      changed: false,
      replicationKey: null,
      discoveryKey: null,
      encryptionKey: null,
      projectKeyPair: null,
      projects: null,
      draftSelection: null
    }
  })

  handler('load draft', (data, state, reduce, done) => {
    loadDraft(data, state, reduce, done)
  })

  function loadDraft (data, state, reduce, done) {
    const digest = data.digest
    withIndexedDB(data.discoveryKey, (error, db) => {
      if (error) return done(error)
      runParallel({
        draft: done => {
          db.getDraft(digest, done)
        },
        marks: done => {
          db.getMarks(digest, done)
        },
        notes: done => {
          db.getNotes(digest, done)
        },
        children: done => {
          db.getChildren(digest, done)
        },
        comparing: done => {
          if (data.comparing) {
            db.getDraft(data.comparing, done)
          } else done()
        }
      }, (error, results) => {
        if (error) return done(error)
        results.draft.digest = digest
        const parents = results.draft.parents
        runParallel(parents.map(digest => {
          return done => {
            db.getDraft(digest, (error, parent) => {
              if (error) return done(error)
              parent.digest = digest
              done(null, parent)
            })
          }
        }), (error, parents) => {
          if (error) return done(error)
          results.parents = parents
          reduce('draft', results)
          done()
        })
      })
    })
  }

  reloadHandler('draft', loadDraft)

  reduction('draft', (data, state) => {
    const children = data.children || []
    const notes = data.notes || []
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

  handler('load subscription', (_, state, reduce, done) => {
    withIndexedDB('proseline', (error, db) => {
      if (error) return done(error)
      db.getSubscription((error, subscription) => {
        if (error) return done(error)
        reduce('subscription', subscription || {})
        done()
      })
    })
  })

  reduction('subscription', (subscription, state) => {
    return { subscription: subscription }
  })

  handler(
    'add device to subscription',
    (data, state, reduce, done) => {
      assert(has(data, 'email'))
      withIndexedDB('proseline', (error, db) => {
        if (error) return done(error)
        db.getClientKeyPair((error, clientKeyPair) => {
          if (error) return done(error)
          const email = data.email
          const entry = {
            email,
            name: data.name,
            date: new Date().toISOString()
          }
          const request = {
            entry,
            clientPublicKey: clientKeyPair.publicKey,
            signature: crypto.signJSON(entry, clientKeyPair.secretKey)
          }
          fetch('https://paid.proseline.com/add', {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/json' },
            referrer: 'no-referrer',
            body: JSON.stringify(request)
          })
            .then(response => {
              const status = response.status
              if (status !== 200) {
                return done(new Error('server responded ' + status))
              }
              return response.json()
            })
            .then(body => {
              if (body.error) return done(body.error)
              const subscription = { email }
              db.setSubscription({ email }, error => {
                if (error) return done(error)
                reduce('subscription', subscription)
                // TODO: Tell Client to reconnect on subscribe.
                done()
              })
            })
            .catch(error => { done(error) })
        })
      })
    }
  )

  handler('load parents', (data, state, reduce, done) => {
    loadParents(data, state, reduce, done)
  })

  reloadHandler('parents', loadParents)

  function loadParents (data, state, reduce, done) {
    assert(has(data, 'parentDigests'))
    const parentDigests = data.parentDigests
    assert(Array.isArray(parentDigests))
    assert(parentDigests.length > 0)
    assert(parentDigests.every(element => {
      return (
        typeof element === 'string' &&
        element.length === 64
      )
    }))
    withIndexedDB(state.discoveryKey, (error, db) => {
      if (error) return done(error)
      runParallel(parentDigests.map(digest => {
        return done => {
          db.getDraft(digest, done)
        }
      }), (error, parents) => {
        if (error) return done(error)
        reduce('parents', parents)
        done()
      })
    })
  }

  reduction('parents', (parents, state) => {
    return { parents }
  })

  handler('load mark', (data, state, reduce, done) => {
    loadMark(data, state, reduce, done)
  })

  reloadHandler('mark', loadMark)

  function loadMark (data, state, reduce, done) {
    assert(has(data, 'discoveryKey'))
    assert(has(data, 'logPublicKey'))
    assert(has(data, 'identifier'))
    withIndexedDB(data.discoveryKey, (error, db) => {
      if (error) return done(error)
      db.markHistory(data.logPublicKey, data.identifier, 100, (error, history) => {
        if (error) return done(error)
        const latestMark = history[0]
        reduce('mark', {
          markPublicKey: latestMark.logPublicKey,
          markIdentifier: latestMark.identifier,
          mark: latestMark,
          markHistory: history
        })
        done()
      })
    })
  }

  reduction('mark', (data, state) => {
    return data
  })

  // Drafts

  handler('save', (data, state, reduce, done) => {
    const logKeyPair = state.logKeyPair
    const entry = {
      type: 'draft',
      parents: data.parents || [],
      text: data.text,
      timestamp: new Date().toISOString()
    }
    withIndexedDB(state.discoveryKey, (error, db) => {
      if (error) return done(error)
      db.putDraft(entry, logKeyPair, (error, entry, digest) => {
        if (error) return done(error)
        reduce('push draft', entry)
        reduce('push brief', {
          digest: digest,
          discoveryKey: entry.discoveryKey,
          logPublicKey: logKeyPair.publicKey,
          parents: entry.parents,
          timestamp: entry.timestamp
        })
        window.history.pushState(
          {}, null,
          '/projects/' + crypto.base64ToHex(state.discoveryKey) +
          '/drafts/' + crypto.base64ToHex(digest)
        )
        done()
      })
    })
  })

  reduction('push draft', (entry, state) => {
    return { activity: [entry].concat(state.activity) }
  })

  reduction('push brief', (brief, state) => {
    return { draftBriefs: (state.draftBriefs || []).concat(brief) }
  })

  // Marks

  handler('mark', (data, state, reduce, done) => {
    putMark(
      data.identifier, data.name, state.draft.digest, state,
      (error, mark) => {
        if (error) return done(error)
        reduce('push mark', mark)
        done()
      }
    )
  })

  reduction('push mark', (mark, state) => {
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
        .concat(oldMarks.filter(oldMark => {
          return !(
            oldMark.logPublicKey === newMark.logPublicKey &&
            identifierOf(oldMark) === identifierOf(newMark)
          )
        }))
    }
    function identifierOf (mark) {
      return mark.identifier
    }
  })

  function putMark (identifier, name, draft, state, callback) {
    identifier = identifier || crypto.random(4)
    const logKeyPair = state.logKeyPair
    const entry = {
      type: 'mark',
      identifier: identifier,
      name: name,
      timestamp: new Date().toISOString(),
      draft: draft
    }
    withIndexedDB(state.discoveryKey, (error, db) => {
      if (error) return callback(error)
      db.putMark(entry, logKeyPair, (error, entry) => {
        if (error) return callback(error)
        callback(null, entry)
      })
    })
  }

  // Notes

  handler('note', (data, state, reduce, done) => {
    const logKeyPair = state.logKeyPair
    const entry = {
      type: 'note',
      draft: state.draft.digest,
      text: data.text,
      timestamp: new Date().toISOString()
    }
    if (data.parent) entry.parent = data.parent
    else if (data.range) entry.range = data.range
    withIndexedDB(state.discoveryKey, (error, db) => {
      if (error) return done(error)
      db.putNote(entry, logKeyPair, (error, entry) => {
        if (error) return done(error)
        reduce('push note', entry)
        done()
      })
    })
  })

  reduction('push note', (newNote, state) => {
    const notes = state.notes.concat(newNote)
    return {
      notes: notes,
      notesTree: treeifyNotes(notes),
      replyTo: null,
      activity: [newNote].concat(state.activity),
      draftBriefs: state.draftBriefs.map(brief => {
        if (brief.digest === newNote.draft) {
          brief.notesCount++
        }
        return brief
      })
    }
  })

  handler('reply to', (parent, state, reduce, done) => {
    reduce('reply to', parent)
    done()
  })

  reduction('reply to', (parent, state) => {
    return { replyTo: parent }
  })

  handler('select draft', (digest, state, reduce, done) => {
    reduce('select draft', digest)
    done()
  })

  reduction('select draft', (draftSelection, state) => {
    return { draftSelection }
  })

  handler('deselect draft', (digest, state, reduce, done) => {
    reduce('deselect draft', digest)
    done()
  })

  reduction('deselect draft', (digest, state) => {
    return { draftSelection: null }
  })

  // Change

  handler('changed', (parent, state, reduce, done) => {
    reduce('changed')
    done()
  })

  reduction('changed', function () {
    return { changed: true }
  })

  handler('peers', (count, state, reduce, done) => {
    reduce('peers', count)
    done()
  })

  reduction('peers', count => {
    return { peers: count }
  })

  // Downloads

  // TODO: Download in a word processor format
  handler('download', (_, state, reduce, done) => {
    saveAs(
      new Blob(
        [JSON.stringify(state.draft.text)],
        { type: 'application/json;charset=utf-8' }
      ),
      'proseline.json',
      true // Omit BOM.
    )
  })

  handler('backup', (_, state, reduce, done) => {
    withIndexedDB('proseline', (error, db) => {
      if (error) return done(error)
      runParallel({
        projects: done => {
          db.listProjects((error, projects) => {
            if (error) return done(error)
            runParallel(projects.map(project => {
              return done => {
                if (project.deleted) return done(null, { project })
                withIndexedDB(project.discoveryKey, (error, db) => {
                  if (error) return done(error)
                  db.getDefaultLogKeyPair((error, logKeyPair) => {
                    if (error) return done(error)
                    done(null, { project, logKeyPair })
                  })
                })
              }
            }), done)
          })
        },
        clientKeyPair: done => {
          db.getClientKeyPair(done)
        },
        subscription: done => {
          db.getSubscription(done)
        }
      }, (error, results) => {
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
    handler('reload ' + name, (data, state, reduce, done) => {
      runParallel([
        done => {
          loader(data, state, reduce, done)
        },
        done => {
          loadProject(data.discoveryKey, state, reduce, done)
        }
      ], done)
    })
  }
}
