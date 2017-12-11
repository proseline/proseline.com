var loading = require('./loading')

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
    var form = document.createElement('form')
    var parent = state.parent
    form.addEventListener('submit', function (event) {
      event.preventDefault()
      event.stopPropagation()
      send('save', {
        discoveryKey: discoveryKey,
        text: textarea.value,
        parents: parent ? [parent.digest] : [],
        mark: mark.value
      })
    })
    main.appendChild(form)

    // Buttons
    var save = document.createElement('button')
    save.type = 'submit'
    save.appendChild(document.createTextNode('Save'))
    form.appendChild(save)

    // Mark
    var mark = document.createElement('input')
    mark.type = 'text'
    mark.required = true
    mark.placeholder = 'Enter a mark name.'
    form.appendChild(mark)

    // <textarea>
    var textarea = document.createElement('textarea')
    textarea.className = 'editor'
    if (parent) {
      textarea.value = state.parent.entry.payload.text
    }
    form.appendChild(textarea)
  }
  return main
}
