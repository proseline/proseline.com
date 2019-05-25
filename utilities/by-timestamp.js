module.exports = function (a, b) {
  var aDate = new Date(a.innerEnvelope.entry.timestamp)
  var bDate = new Date(b.innerEnvelope.entry.timestamp)
  return aDate - bDate
}
