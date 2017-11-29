module.exports = function (state, send) {
  var section = document.createElement('section')

  var h1 = document.createElement('h1')
  h1.appendChild(document.createTextNode('Your Identity'))
  section.appendChild(h1)

  if (state.intro === null) {
    section.appendChild(introForm(send))
  } else {
    var p = document.createElement('p')
    var payload = state.intro.payload
    p.appendChild(
      document.createTextNode(
        payload.name + ' on ' + payload.device
      )
    )
    section.appendChild(p)
  }
  return section
}

function introForm (send) {
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
  button.appendChild(document.createTextNode('Introduce Yourself'))
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
