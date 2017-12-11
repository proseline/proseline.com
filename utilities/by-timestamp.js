module.exports = function (a, b) {
  var aDate = new Date(a.entry.payload.timestamp)
  var bDate = new Date(b.entry.payload.timestamp)
  return aDate - bDate
}
