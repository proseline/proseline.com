module.exports = function (link) {
  const returned = document.createDocumentFragment()
  const first = document.createElement('p')
  returned.appendChild(first)
  first.appendChild(document.createTextNode(
    'Proseline is free to use, ' +
    'but you must be online and have proseline.com open ' +
    'in your web browser to share your work with others.'
  ))
  const second = document.createElement('p')
  returned.appendChild(second)
  second.appendChild(document.createTextNode(
    'To share your work even when you ' +
    'are not online, '
  ))
  const SUBSCRIBE = 'subscribe to Proseline’s sharing service'
  if (link) {
    const a = document.createElement('a')
    second.appendChild(a)
    a.href = '/subscription'
    a.appendChild(document.createTextNode(SUBSCRIBE))
    second.appendChild(document.createTextNode('.'))
  } else {
    second.appendChild(document.createTextNode(SUBSCRIBE))
  }
  return returned
}
