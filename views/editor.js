const assert = require('nanoassert')
const beforeUnload = require('../before-unload')
const initializeEditor = require('../editor')
const onKeyDown = require('./on-key-down')
const renderDraftHeader = require('./partials/draft-header')
const renderLoading = require('./loading')
const withProject = require('./with-project')

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
  const main = document.createElement('main')
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
    // TODO: Action isn't defined, and this code never seems to run.
    main.appendChild(
      renderLoading(function () {
        send('reload parents', { discoveryKey, parentDigests })
      })
    )
  } else {
    const form = document.createElement('form')
    form.className = 'saveDraftForm'
    main.appendChild(form)

    form.addEventListener('submit', function (event) {
      event.preventDefault()
      event.stopPropagation()
      send('save', {
        discoveryKey,
        text: editor.state.doc.toJSON(),
        parents: parentDigests || []
      })
    })

    // Save Button
    const save = document.createElement('button')
    form.appendChild(save)
    save.className = 'button'
    save.appendChild(document.createTextNode('Save'))

    main.appendChild(renderDraftHeader(state, form))

    // Editor
    const div = document.createElement('div')
    main.appendChild(div)
    div.className = 'editor'
    let content = false
    if (parentDigests && parentDigests.length > 0) {
      content = state.parents[0].text
    }
    // TODO: Diff starting point for merge drafts.
    const editor = initializeEditor({
      element: div,
      content,
      dirty: function (dirty) {
        if (dirty) beforeUnload.enable()
        else beforeUnload.disable()
      }
    })
    div.onkeydown = onKeyDown(editor, parentDigests || [], state, send)
  }
  return main
})
