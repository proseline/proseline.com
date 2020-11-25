module.exports = (a, b) => {
  const aDate = new Date(a.timestamp)
  const bDate = new Date(b.timestamp)
  return aDate - bDate
}
