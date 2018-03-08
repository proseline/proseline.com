var assert = require('assert')
var diff = require('diff/lib/diff/line').diffLines
var renderDraftHeader = require('./partials/draft-header')
var renderLoading = require('./loading')
var withProject = require('./with-project')

module.exports = withProject(function (state, send, discoveryKey, parentDigests) {
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
  if (
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
        send('reload parents', {discoveryKey, parentDigests})
      })
    )
  } else {
    var form = document.createElement('form')
    form.className = 'saveDraftForm'
    main.appendChild(form)

    form.addEventListener('submit', function (event) {
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
    form.appendChild(save)
    save.className = 'button'
    save.appendChild(document.createTextNode('Save'))

    main.appendChild(renderDraftHeader(state, form))

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
})
