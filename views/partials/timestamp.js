module.exports = function (timestamp) {
  var span = document.createElement('span')
  span.appendChild(
    document.createTextNode(
      formatTimestamp(timestamp)
    )
  )
  return span
}

function formatTimestamp (timestamp) {
  return new Date(timestamp)
    .toLocaleString()
    .replace(', ', ' at ')
}
