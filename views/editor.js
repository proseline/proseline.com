var assert = require('assert')
var diff = require('diff/lib/diff/line').diffLines
var renderDraftHeader = require('./partials/draft-header')
var renderLoading = require('./loading')
var screenfull = require('screenfull')

module.exports = function (state, send, discoveryKey, parentDigests) {
  state.route = 'editor'
  assert(
    parentDigests === undefined ||
    (
      Array.isArray(parentDigests) &&
      parentDigests.length > 0 &&
      parentDigests.every(function (element) {
        return (
          typeof element === 'string' &&
          element.length === 64
        )
      })
    )
  )
  var main = document.createElement('main')
  if (state.discoveryKey !== discoveryKey) {
    main.appendChild(
      renderLoading(function () {
        send('load project', discoveryKey)
      })
    )
  } else if (
    parentDigests &&
    (
      state.parents === null ||
      state.parents.length !== parentDigests.length ||
      !parentDigests.every(function (digest) {
        return state.parents.some(function (parent) {
          return parent.digest === digest
        })
      })
    )
  ) {
    main.appendChild(
      renderLoading(function () {
        send('load parents', {discoveryKey, parentDigests})
      })
    )
  } else {
    var headerAddition = document.createDocumentFragment()

    var saveForm = document.createElement('form')
    headerAddition.appendChild(saveForm)
    saveForm.className = 'saveDraftForm'
    main.appendChild(saveForm)
    saveForm.addEventListener('submit', function (event) {
      event.preventDefault()
      event.stopPropagation()
      send('save', {
        discoveryKey: discoveryKey,
        text: textarea.value,
        parents: parentDigests || []
      })
    })

    // Save Button
    var save = document.createElement('button')
    saveForm.appendChild(save)
    save.className = 'button'
    save.appendChild(document.createTextNode('Save'))

    if (screenfull.enabled) {
      var fullScreenButton = document.createElement('button')
      headerAddition.appendChild(fullScreenButton)
      fullScreenButton.appendChild(document.createTextNode('Full Screen'))
      fullScreenButton.addEventListener('click', function () {
        screenfull.request()
      })
    }

    main.appendChild(renderDraftHeader(state, headerAddition))

    // <textarea>
    var textarea = document.createElement('textarea')
    textarea.autofocus = true
    textarea.spellcheck = true
    textarea.className = 'editor'
    if (parentDigests) {
      if (parentDigests.length === 1) {
        textarea.value = state.parents[0].message.body.text
      } else {
        var first = state.parents[0].message.body.text
        var second = state.parents[1].message.body.text
        textarea.value = diff(first, second)
          .map(function (change) {
            var text = change.value
            if (change.added) return '[inserted:]' + text + '[end]'
            else if (change.removed) return '[deleted:]' + text + '[end]'
            else return text
          })
          .join('')
      }
    }
    main.appendChild(textarea)
  }
  return main
}
