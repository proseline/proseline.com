var renderLoading = require('./loading')
var renderDraftHeader = require('./partials/draft-header')
var renderRefreshNotice = require('./partials/refresh-notice')

module.exports = function (state, send, discoveryKey, parentDigest) {
  var main = document.createElement('main')
  if (state.discoveryKey !== discoveryKey) {
    main.appendChild(
      renderLoading(function () {
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
      renderLoading(function () {
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

    var form = document.createElement('form')
    form.className = 'saveDraftForm'
    main.appendChild(form)

    form.addEventListener('submit', function (event) {
      event.preventDefault()
      event.stopPropagation()
      send('save', {
        discoveryKey: discoveryKey,
        text: textarea.value,
        parents: parent ? [parent.digest] : []
      })
    })

    // Save Button
    var save = document.createElement('button')
    form.appendChild(save)
    save.className = 'button'
    save.appendChild(document.createTextNode('Save'))

    main.appendChild(renderDraftHeader(state, form))

    // <textarea>
    var textarea = document.createElement('textarea')
    textarea.autofocus = true
    textarea.spellcheck = true
    textarea.className = 'editor'
    if (parent) {
      textarea.value = state.parent.message.body.text
    }
    main.appendChild(textarea)
  }
  return main
}
