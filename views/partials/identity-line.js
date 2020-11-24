module.exports = function (send) {
  const form = document.createElement('form')
  form.className = 'intro'

  // Name
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Enter your name.'
  input.required = true
  form.appendChild(input)

  form.appendChild(document.createTextNode('on'))

  // Device
  const select = document.createElement('select')
  const devices = [
    'desktop', 'laptop', 'phone', 'tablet'
  ]
  select.appendChild(document.createElement('option'))
  select.required = true
  devices.forEach(function (device) {
    const option = document.createElement('option')
    option.value = device
    option.appendChild(document.createTextNode(device))
    select.appendChild(option)
  })
  form.appendChild(select)

  // Button
  const button = document.createElement('button')
  button.type = 'submit'
  button.appendChild(document.createTextNode('Introduce yourself.'))
  form.appendChild(button)

  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('set user intro', {
      name: input.value,
      device: select.value
    })
  })

  return form
}
