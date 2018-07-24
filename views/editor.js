var assert = require('assert')
var beforeUnload = require('../before-unload')
var initializeEditor = require('../editor')
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
        text: editor.state.doc.toJSON(),
        parents: parentDigests || []
      })
    })

    // Save Button
    var save = document.createElement('button')
    form.appendChild(save)
    save.className = 'button'
    save.appendChild(document.createTextNode('Save'))

    main.appendChild(renderDraftHeader(state, form))

    // Editor
    var div = document.createElement('div')
    main.appendChild(div)
    div.className = 'editor'
    var content = false
    if (parentDigests && parentDigests.length > 0) {
      content = state.parents[0].message.body.text
    }
    // TODO: Diff starting point for merge drafts.
    var editor = initializeEditor({
      element: div,
      content,
      dirty: function (dirty) {
        if (dirty) beforeUnload.enable()
        else beforeUnload.disable()
      }
    })
  }
  return main
})
