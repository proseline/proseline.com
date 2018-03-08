var assert = require('assert')
var renderActivity = require('./partials/activity')
var renderDraftHeader = require('./partials/draft-header')
var renderLoading = require('./loading')
var renderRefreshNotice = require('./partials/refresh-notice')
var withProject = require('./with-project')

module.exports = withProject(function (state, send, discoveryKey, publicKey) {
  state.route = 'member'
  assert.equal(typeof state, 'object')
  assert.equal(typeof send, 'function')
  assert.equal(typeof discoveryKey, 'string')
  assert.equal(discoveryKey.length, 64)
  assert.equal(typeof publicKey, 'string')
  assert.equal(publicKey.length, 64)
  var main = document.createElement('main')
  if (state.member === publicKey && state.memberActivity) {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('reload member', discoveryKey)
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
          discoveryKey: discoveryKey,
          publicKey: publicKey
        })
      })
    )
  }
  return main
})
