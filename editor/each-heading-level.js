module.exports = function (iterator) {
  return new Array(6)
    .fill()
    .map(function (_, index) {
      return iterator(index + 1)
    })
}
