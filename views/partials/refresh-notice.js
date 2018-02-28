module.exports = function (onclick) {
  var div = document.createElement('div')
  div.addEventListener('click', function () {
    onclick()
  })
  div.className = 'refresh'
  div.appendChild(document.createTextNode('Click to show new work from others.'))
  return div
}
