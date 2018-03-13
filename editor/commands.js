var pmCommands = require('prosemirror-commands')
var schema = require('./schema')

var chainCommands = pmCommands.chainCommands
var exitCode = pmCommands.exitCode

exports.backspace = chainCommands(
  pmCommands.deleteSelection,
  pmCommands.joinBackward,
  pmCommands.selectNodeBackward
)

exports.delete = chainCommands(
  pmCommands.deleteSelection,
  pmCommands.joinForward,
  pmCommands.selectNodeForward
)

exports.selectAll = pmCommands.selectAll

exports.strong = pmCommands.toggleMark(schema.marks.strong)
exports.em = pmCommands.toggleMark(schema.marks.em)
exports.code = pmCommands.toggleMark(schema.marks.code)

exports.enter = chainCommands(
  pmCommands.newlineInCode,
  pmCommands.createParagraphNear,
  pmCommands.liftEmptyBlock,
  pmCommands.splitBlock
)

exports.br = chainCommands(
  exitCode,
  function (state, dispatch) {
    if (dispatch) {
      dispatch(
        state.tr
          .replaceSelectionWith(schema.nodes.br.create())
          .scrollIntoView()
      )
    }
    return true
  }
)

exports.hr = function (state, dispatch) {
  if (!canInsert(state, schema.nodes.hr)) return false
  if (dispatch) {
    dispatch(
      state.tr
        .replaceSelectionWith(schema.nodes.hr.create())
        .scrollIntoView()
    )
  }
  return true
}

function canInsert (state, type) {
  var $from = state.selection.$from
  var depth = $from.depth
  while (depth > 0) {
    depth--
    var index = $from.index(depth)
    if ($from.node(depth).canReplaceWith(index, index, type)) {
      return true
    }
  }
  return false
}
