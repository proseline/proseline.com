module.exports = function (a, b) {
  var aDate = new Date(a.timestamp)
  var bDate = new Date(b.timestamp)
  return aDate - bDate
}
