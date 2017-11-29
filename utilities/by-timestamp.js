module.exports = function (a, b) {
  var aDate = new Date(a.payload.timestamp)
  var bDate = new Date(b.payload.timestamp)
  return aDate - bDate
}
