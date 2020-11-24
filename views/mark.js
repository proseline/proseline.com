const assert = require('nanoassert')
const renderDraftHeader = require('./partials/draft-header')
const renderDraftLink = require('./partials/draft-link')
const renderLoading = require('./loading')
const renderRefreshNotice = require('./partials/refresh-notice')
const renderRelativeTimestamp = require('./partials/relative-timestamp')
const withProject = require('./with-project')

module.exports = withProject((state, send, discoveryKey, logPublicKey, identifier) => {
  state.route = 'mark'
  assert(typeof state === 'object')
  assert(typeof send === 'function')
  assert(typeof discoveryKey === 'string')
  assert(discoveryKey.length === 64)
  assert(typeof logPublicKey === 'string')
  assert(logPublicKey.length === 64)
  assert(typeof identifier === 'string')
  assert(identifier.length, 8)
  const main = document.createElement('main')
  if (
    state.markPublicKey !== logPublicKey ||
    state.markIdentifier !== identifier
  ) {
    main.appendChild(
      renderLoading(function () {
        send('load mark', {
          discoveryKey,
          logPublicKey: logPublicKey,
          identifier: identifier
        })
      })
    )
  } else {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('reload mark', { discoveryKey, logPublicKey, identifier })
      }))
    }
    main.appendChild(renderDraftHeader(state))

    const section = document.createElement('section')
    main.appendChild(section)

    const h2 = document.createElement('h2')
    section.appendChild(h2)
    h2.appendChild(document.createTextNode('Mark History'))

    section.appendChild(renderMarkHistory(state))
  }
  return main
})

function renderMarkHistory (state) {
  const ol = document.createElement('ol')
  ol.className = 'activity'
  state.markHistory.forEach(entry => {
    const li = document.createElement('li')
    ol.appendChild(li)
    const brief = state.draftBriefs.find(brief => {
      return brief.digest === entry.draft
    })
    li.appendChild(renderDraftLink(state, brief))
    li.appendChild(document.createTextNode(' '))
    li.appendChild(renderRelativeTimestamp(brief.timestamp))
  })
  return ol
}
