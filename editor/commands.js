var pmCommands = require('prosemirror-commands')
var pmSchemaList = require('prosemirror-schema-list')
var schema = require('./schema')

var chainCommands = pmCommands.chainCommands
var exitCode = pmCommands.exitCode
var splitListItem = pmSchemaList.splitListItem
var wrapIn = pmCommands.wrapIn

exports.backspace = pmCommands.chainCommands(
  pmCommands.deleteSelection,
  pmCommands.joinBackward,
  pmCommands.selectNodeBackward
)

exports.delete = pmCommands.chainCommands(
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

exports.break = chainCommands(
  exitCode,
  function (state, dispatch) {
    dispatch(
      state.tr
        .replaceSelectionWith(schema.nodes.br.create())
        .scrollIntoView()
    )
    return true
  }
)

exports.enter = splitListItem
