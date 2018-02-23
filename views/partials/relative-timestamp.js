var moment = require('moment')

module.exports = function (timestamp) {
  var span = document.createElement('span')
  span.className = 'relativeTimestamp'
  span.dataset.timestamp = timestamp
  span.appendChild(document.createTextNode(
    moment(timestamp).fromNow()
  ))
  return span
}
