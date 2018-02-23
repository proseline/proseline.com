var loading = require('./loading')
var renderDraftHeader = require('./partials/draft-header')
var renderRefreshNotice = require('./partials/refresh-notice')

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

    var form = document.createElement('form')
    form.id = 'draft'
    main.appendChild(form)

    form.addEventListener('submit', function (event) {
      event.preventDefault()
      event.stopPropagation()
      var continuing = marksICanMove.find(function (mark) {
        return mark.message.body.name === input.value
      })
      send('save', {
        discoveryKey: discoveryKey,
        text: textarea.value,
        parents: parent ? [parent.digest] : [],
        mark: {
          name: input.value,
          identifier: continuing
            ? continuing.message.body.identifier
            : null
        }
      })
    })

    var marksICanMove = state.projectMarks.filter(function (mark) {
      return mark.publicKey === state.identity.publicKey
    })
    var haveMarks = marksICanMove.length !== 0

    // Marker Input
    var input = document.createElement('input')
    form.appendChild(input)
    input.placeholder = 'Enter a name.'
    input.required = true
    if (haveMarks) {
      var continuing = marksICanMove
        .reverse()
        .find(function (mark) {
          return parent && mark.message.body.draft === parent.digest
        })
      if (continuing) {
        input.value = continuing.message.body.name
      }
    }

    if (haveMarks) {
      var datalist = document.createElement('datalist')
      datalist.id = 'existingMarks'
      input.setAttribute('list', datalist.id)
      form.appendChild(datalist)
      marksICanMove.forEach(function (mark) {
        var option = document.createElement('option')
        datalist.appendChild(option)
        option.appendChild(document.createTextNode(
          mark.message.body.name
        ))
      })
    }

    // Save Button
    var save = document.createElement('button')
    form.appendChild(save)
    save.className = 'button'
    save.id = 'save'
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
