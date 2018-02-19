module.exports = function (a, b) {
  var aDate = new Date(a.message.body.timestamp)
  var bDate = new Date(b.message.body.timestamp)
  return aDate - bDate
}
