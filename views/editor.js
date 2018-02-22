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
        mark: {
          name: (
            input.value ||
            select.options[select.selectedIndex].innerText
          ),
          identifier: input.value
            ? null
            : select.options[select.selectedIndex].value
        }
      })
    })

    var marksICanMove = state.projectMarks.filter(function (mark) {
      return mark.publicKey === state.identity.publicKey
    })
    var haveMarks = marksICanMove.length !== 0

    // Marker Input
    var input = document.createElement('input')
    input.placeholder = 'Enter a name.'
    input.required = true

    if (haveMarks) {
      // Marker Select
      var select = document.createElement('select')
      form.appendChild(select)
      var toggleInput = function () {
        if (select.selectedIndex === 0) {
          input.required = true
          select.parentNode.insertBefore(input, select.nextSibling)
        } else {
          input.value = ''
          input.remove()
        }
      }
      select.addEventListener('change', function () {
        toggleInput()
      })
      var newOption = document.createElement('option')
      newOption.appendChild(document.createTextNode('(Create a new marker.)'))
      select.appendChild(newOption)
      var markedSelected = false
      marksICanMove
        .reverse()
        .forEach(function (mark) {
          var option = document.createElement('option')
          select.appendChild(option)
          var body = mark.message.body
          option.value = body.identifier
          option.appendChild(document.createTextNode(body.name))
          if (parent && body.draft === parent.digest && !markedSelected) {
            option.selected = true
            markedSelected = true
          }
        })
      toggleInput()
    } else {
      form.appendChild(input)
    }

    // Save Button
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
