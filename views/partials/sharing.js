module.exports = function () {
  var returned = document.createDocumentFragment()
  var first = document.createElement('p')
  returned.appendChild(first)
  first.appendChild(document.createTextNode(
    'Proseline is free to use. ' +
    'However, in order to share your work with others, ' +
    'you must be online and have proseline.com open ' +
    'in your web browser.'
  ))
  var second = document.createElement('p')
  returned.appendChild(second)
  second.appendChild(document.createTextNode(
    'If you would like to share your work even when you ' +
    'are not online, consider subscribing to Proseline’s ' +
    'sharing service.'
  ))
  return returned
}
