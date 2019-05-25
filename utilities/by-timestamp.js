module.exports = function (a, b) {
  var aDate = new Date(a.entry.body.timestamp)
  var bDate = new Date(b.entry.body.timestamp)
  return aDate - bDate
}
