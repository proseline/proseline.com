module.exports = iterator => {
  return new Array(6)
    .fill()
    .map((_, index) => {
      return iterator(index + 1)
    })
}
