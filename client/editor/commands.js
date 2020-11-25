const eachHeadingLevel = require('./each-heading-level')
const pmCommands = require('prosemirror-commands')
const schema = require('./schema')

const chainCommands = pmCommands.chainCommands
const exitCode = pmCommands.exitCode
const setBlockType = pmCommands.setBlockType
const lift = pmCommands.lift

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
  (state, dispatch) => {
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

exports.hr = (state, dispatch) => {
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
  const $from = state.selection.$from
  let depth = $from.depth
  while (depth > 0) {
    depth--
    const index = $from.index(depth)
    if ($from.node(depth).canReplaceWith(index, index, type)) {
      return true
    }
  }
  return false
}

eachHeadingLevel(level => {
  const name = 'h' + level
  exports[name] = setBlockType(schema.nodes.heading, { level })
})

exports.listing = setBlockType(schema.nodes.listing)
exports.paragraph = setBlockType(schema.nodes.paragraph)

exports.lift = lift
