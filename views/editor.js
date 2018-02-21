var loading = require('./loading')
var renderDraftHeader = require('./partials/draft-header')
var renderRefreshNotice = require('./partials/refresh-notice')

// TODO: nice editor

module.exports = function (state, send, discoveryKey, parentDigest) {
  var main = document.createElement('main')
  if (state.discoveryKey !== discoveryKey) {
    main.appendChild(
      loading(function () {
        send('load project', discoveryKey)
      })
    )
  } else if (
    parentDigest &&
    (
      state.parent === null ||
      state.parent.digest !== parentDigest
    )
  ) {
    main.appendChild(
      loading(function () {
        send('load parent', {
          discoveryKey: discoveryKey,
          digest: parentDigest
        })
      })
    )
  } else {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('load parent', {
          discoveryKey: discoveryKey,
          digest: parentDigest
        })
      }))
    }
    var parent = state.parent

    // Header with Save Button
    var save = document.createElement('button')
    save.className = 'button'
    save.id = 'save'
    save.addEventListener('click', function () {
      if (textarea.value.length === 0) {
        window.alert('Draft is empty.')
        return
      }
      var markName = window.prompt('Name this draft:')
      if (markName === null) return
      if (markName.length === 0) return
      send('save', {
        discoveryKey: discoveryKey,
        text: textarea.value,
        parents: parent ? [parent.digest] : [],
        mark: markName
      })
    })
    save.appendChild(document.createTextNode('Save'))
    main.appendChild(renderDraftHeader(state, save))

    // <textarea>
    var textarea = document.createElement('textarea')
    textarea.className = 'editor'
    if (parent) {
      textarea.value = state.parent.message.body.text
    }
    main.appendChild(textarea)
  }
  return main
}
