var assert = require('assert')
var renderActivity = require('./partials/activity')
var renderDraftHeader = require('./partials/draft-header')
var renderLoading = require('./loading')
var renderRefreshNotice = require('./partials/refresh-notice')
var withProject = require('./with-project')

module.exports = withProject(function (state, send, projectDiscoveryKey, publicKey) {
  state.route = 'member'
  assert.strictEqual(typeof state, 'object')
  assert.strictEqual(typeof send, 'function')
  assert.strictEqual(typeof projectDiscoveryKey, 'string')
  assert.strictEqual(projectDiscoveryKey.length, 64)
  assert.strictEqual(typeof publicKey, 'string')
  assert.strictEqual(publicKey.length, 64)
  var main = document.createElement('main')
  if (state.member === publicKey && state.memberActivity) {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('reload member', projectDiscoveryKey)
      }))
    }
    main.appendChild(renderDraftHeader(state))

    var section = document.createElement('section')
    main.appendChild(section)

    var h2 = document.createElement('h2')
    section.appendChild(h2)
    h2.appendChild(document.createTextNode('Member Activity'))

    section.appendChild(renderActivity(state, state.memberActivity))
  } else {
    main.appendChild(
      renderLoading(function () {
        send('load member', {
          projectDiscoveryKey,
          publicKey: publicKey
        })
      })
    )
  }
  return main
})
