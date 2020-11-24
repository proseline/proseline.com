const assert = require('nanoassert')
const renderActivity = require('./partials/activity')
const renderDraftHeader = require('./partials/draft-header')
const renderLoading = require('./loading')
const renderRefreshNotice = require('./partials/refresh-notice')
const withProject = require('./with-project')

module.exports = withProject(function (state, send, discoveryKey, logPublicKey) {
  state.route = 'member'
  assert(typeof state === 'object')
  assert(typeof send === 'function')
  assert(typeof discoveryKey === 'string')
  assert(discoveryKey.length === 64)
  assert(typeof logPublicKey === 'string')
  assert(logPublicKey.length === 64)
  const main = document.createElement('main')
  if (state.member === logPublicKey && state.memberActivity) {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('reload member', discoveryKey)
      }))
    }
    main.appendChild(renderDraftHeader(state))

    const section = document.createElement('section')
    main.appendChild(section)

    const h2 = document.createElement('h2')
    section.appendChild(h2)
    h2.appendChild(document.createTextNode('Member Activity'))

    section.appendChild(renderActivity(state, state.memberActivity))
  } else {
    main.appendChild(
      renderLoading(function () {
        send('load member', {
          discoveryKey,
          logPublicKey: logPublicKey
        })
      })
    )
  }
  return main
})
