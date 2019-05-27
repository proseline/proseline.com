var assert = require('nanoassert')
var renderDraftHeader = require('./partials/draft-header')
var renderDraftLink = require('./partials/draft-link')
var renderLoading = require('./loading')
var renderRefreshNotice = require('./partials/refresh-notice')
var renderRelativeTimestamp = require('./partials/relative-timestamp')
var withProject = require('./with-project')

module.exports = withProject(function (state, send, discoveryKey, logPublicKey, identifier) {
  state.route = 'mark'
  assert(typeof state === 'object')
  assert(typeof send === 'function')
  assert(typeof discoveryKey === 'string')
  assert(discoveryKey.length === 64)
  assert(typeof logPublicKey === 'string')
  assert(logPublicKey.length === 64)
  assert(typeof identifier === 'string')
  assert(identifier.length, 8)
  var main = document.createElement('main')
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

    var section = document.createElement('section')
    main.appendChild(section)

    var h2 = document.createElement('h2')
    section.appendChild(h2)
    h2.appendChild(document.createTextNode('Mark History'))

    section.appendChild(renderMarkHistory(state))
  }
  return main
})

function renderMarkHistory (state) {
  var ol = document.createElement('ol')
  ol.className = 'activity'
  state.markHistory.forEach(function (entry) {
    var li = document.createElement('li')
    ol.appendChild(li)
    var brief = state.draftBriefs.find(function (brief) {
      return brief.digest === entry.draft
    })
    li.appendChild(renderDraftLink(state, brief))
    li.appendChild(document.createTextNode(' '))
    li.appendChild(renderRelativeTimestamp(brief.timestamp))
  })
  return ol
}
