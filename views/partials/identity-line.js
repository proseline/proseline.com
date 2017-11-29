module.exports = function (state, send) {
  var section = document.createElement('section')
  // section.appendChild(publicKey(state.identity))
  section.appendChild(nameAndDevice(state.identity, send))
  return section
}

/*
function publicKey (identity) {
  var code = document.createElement('code')
  code.appendChild(document.createTextNode(identity.publicKey))
  return code
}
*/

function nameAndDevice (identity, send) {
  var form = document.createElement('form')
  form.appendChild(nameInput())
  form.appendChild(document.createTextNode(' on '))
  form.appendChild(deviceInput())
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    return false
  })
  return form

  function nameInput () {
    var input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Enter your name.'
    input.value = identity.name || null
    input.addEventListener('change', function () {
      send('identity name', input.value || null)
    })
    return input
  }

  function deviceInput () {
    var select = document.createElement('select')
    var devices = [
      'desktop', 'laptop', 'phone', 'tablet', 'other'
    ]
    select.appendChild(document.createElement('option'))
    devices.forEach(function (device) {
      var option = document.createElement('option')
      option.value = device
      option.appendChild(document.createTextNode(device))
      if (identity.device === device) {
        option.selected = true
      }
      select.appendChild(option)
    })
    select.addEventListener('change', function () {
      send('identity device', select.value || null)
    })
    return select
  }
}
