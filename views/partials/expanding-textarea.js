var autosize = require('autosize')

module.exports = function () {
  var textarea = document.createElement('textarea')
  autosize(textarea)
  return textarea
}
