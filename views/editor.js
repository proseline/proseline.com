module.exports = function (state, send) {
  var main = document.createElement('main')

  var form = document.createElement('form')
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('save', {
      text: textarea.value,
      parents: [],
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
  form.appendChild(textarea)

  return main
}
