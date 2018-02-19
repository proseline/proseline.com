module.exports = function (a, b) {
  var aDate = new Date(a.message.payload.timestamp)
  var bDate = new Date(b.message.payload.timestamp)
  return aDate - bDate
}
