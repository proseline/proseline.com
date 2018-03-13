var pmCommands = require('prosemirror-commands')
var pmSchemaList = require('prosemirror-schema-list')
var schema = require('./schema')

var chainCommands = pmCommands.chainCommands
var createParagraphNear = pmCommands.createParagraphNear
var exitCode = pmCommands.exitCode
var liftEmptyBlock = pmCommands.liftEmptyBlock
var newlineInCode = pmCommands.newlineInCode
var splitBlock = pmCommands.splitBlock
var splitListItem = pmSchemaList.splitListItem
var wrapIn = pmCommands.wrapIn
var wrapInList = pmSchemaList.wrapInList

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
// TODO: exports.link

exports.selectParentNode = pmCommands.selectParentNode

exports.wrapInBlockquote = wrapIn(schema.nodes.blockquote)

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
  if (
    !state.doc.canReplaceWith(
      state.from, state.to,
      schema.nodes.hr
    )
  ) return false
  if (dispatch) {
    dispatch(
      state.tr
        .replaceSelectionWith(schema.nodes.hr.create())
        .scrollIntoView()
    )
  }
  return true
}

exports.enter = chainCommands(
  newlineInCode,
  createParagraphNear,
  liftEmptyBlock,
  splitBlock,
  splitListItem(schema.nodes.li)
)

exports.ol = wrapInList(schema.nodes.ul)
exports.ul = wrapInList(schema.nodes.ol)
