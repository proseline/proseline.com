var autosize = require('autosize')
var loading = require('./loading')
var renderDraftHeader = require('./partials/draft-header')
var renderRefreshNotice = require('./partials/refresh-notice')
var expandingTextArea = require('./partials/expanding-textarea')

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

    main.appendChild(renderDraftHeader(state))

    var form = document.createElement('form')
    form.id = 'draft'
    main.appendChild(form)
    form.addEventListener('submit', function (event) {
      event.preventDefault()
      event.stopPropagation()
      send('save', {
        discoveryKey: discoveryKey,
        text: textarea.value,
        parents: parent ? [parent.digest] : [],
        mark: input.value
      })
    })

    // Marker Input
    var input = document.createElement('input')
    form.appendChild(input)
    input.required = true
    input.placeholder = 'Enter a name.'

    // Header with Save Button
    var save = document.createElement('button')
    form.appendChild(save)
    save.className = 'button'
    save.id = 'save'
    save.appendChild(document.createTextNode('Save'))

    // <textarea>
    var textarea = expandingTextArea()
    textarea.autofocus = true
    textarea.spellcheck = true
    textarea.className = 'editor'
    if (parent) {
      textarea.value = state.parent.message.body.text
    }
    autosize(textarea)
    main.appendChild(textarea)
  }
  return main
}
