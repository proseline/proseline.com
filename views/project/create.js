module.exports = function (state, send) {
  var main = document.createElement('main')

  // <form>
  var form = document.createElement('form')
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('create project', {
      title: input.value
    })
  })
  main.appendChild(form)

  // <input>
  var input = document.createElement('input')
  input.type = 'text'
  form.appendChild(input)

  // <button>
  var button = document.createElement('button')
  button.type = 'submit'
  button.appendChild(document.createTextNode('Create Project'))
  form.appendChild(button)

  return main
}
