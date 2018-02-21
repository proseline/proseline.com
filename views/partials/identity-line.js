module.exports = function (send) {
  var form = document.createElement('form')
  form.className = 'intro'

  // Name
  var input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Enter your name.'
  input.required = true
  form.appendChild(input)

  form.appendChild(document.createTextNode('on'))

  // Device
  var select = document.createElement('select')
  var devices = [
    'desktop', 'laptop', 'phone', 'tablet', 'other'
  ]
  select.appendChild(document.createElement('option'))
  select.required = true
  devices.forEach(function (device) {
    var option = document.createElement('option')
    option.value = device
    option.appendChild(document.createTextNode(device))
    select.appendChild(option)
  })
  form.appendChild(select)

  // Button
  var button = document.createElement('button')
  button.type = 'submit'
  button.appendChild(document.createTextNode('Introduce yourself.'))
  form.appendChild(button)

  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('introduce', {
      name: input.value,
      device: select.value
    })
  })

  return form
}
