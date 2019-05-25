var assert = require('nanoassert')
var renderActivity = require('./partials/activity')
var renderDraftHeader = require('./partials/draft-header')
var renderLoading = require('./loading')
var renderRefreshNotice = require('./partials/refresh-notice')
var withProject = require('./with-project')

module.exports = withProject(function (state, send, projectDiscoveryKey, logPublicKey) {
  state.route = 'member'
  assert(typeof state === 'object')
  assert(typeof send === 'function')
  assert(typeof projectDiscoveryKey === 'string')
  assert(projectDiscoveryKey.length === 64)
  assert(typeof logPublicKey === 'string')
  assert(logPublicKey.length === 64)
  var main = document.createElement('main')
  if (state.member === logPublicKey && state.memberActivity) {
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
          logPublicKey: logPublicKey
        })
      })
    )
  }
  return main
})
