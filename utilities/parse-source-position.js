var RE = /^(\d+):(\d+)-(\d+):(\d+)$/

module.exports = function (node) {
  var match = RE.exec(node.dataset.sourcepos)
  return {
    start: {
      line: parseInt(match[1]) - 1,
      character: parseInt(match[2]) - 1
    },
    end: {
      line: parseInt(match[3]) - 1,
      character: parseInt(match[4]) - 1
    }
  }
}
