const commands = require('./commands')
const eachHeadingLevel = require('./each-heading-level')
const pmMenu = require('prosemirror-menu')
const schema = require('./schema')

const Dropdown = pmMenu.Dropdown
const MenuItem = pmMenu.MenuItem
const icons = pmMenu.icons
const wrapItem = pmMenu.wrapItem

const PARAGRAPH_ICON = require('@fortawesome/fontawesome-free-solid/faParagraph').icon
const CODE_ICON = require('@fortawesome/fontawesome-free-solid/faCode').icon

module.exports = pmMenu.menuBar({
  floating: true,
  content: [
    [
      new MenuItem({
        title: 'Strong',
        label: 'Strong',
        icon: icons.strong,
        active: function (state) {
          return isMarkActive(state, schema.marks.strong)
        },
        enable: function (state) {
          return !state.selection.empty
        },
        run: commands.strong
      }),
      new MenuItem({
        title: 'Emphasis',
        label: 'Emphasis',
        icon: icons.em,
        active: function (state) {
          return isMarkActive(state, schema.marks.em)
        },
        enable: function (state) {
          return !state.selection.empty
        },
        run: commands.em
      }),
      new MenuItem({
        title: 'Code',
        label: 'Code',
        icon: icons.code,
        active: function (state) {
          return isMarkActive(state, schema.marks.code)
        },
        enable: function (state) {
          return !state.selection.empty
        },
        run: commands.code
      })
    ],
    /*
    [
      new MenuItem({
        title: 'Rule',
        label: 'Rule',
        icon: icons.rule,
        enable: commands.hr,
        run: commands.hr
      })
    ],
    */
    [
      new MenuItem({
        title: 'Paragraph',
        label: 'Paragraph',
        icon: faToMenuIcon(PARAGRAPH_ICON),
        enable: commands.paragraph,
        run: commands.paragraph
      }),
      wrapItem(schema.nodes.blockquote, {
        title: 'Quote',
        label: 'Quote',
        icon: icons.blockquote
      }),
      new MenuItem({
        title: 'Lift out of enclosing block',
        run: commands.lift,
        enable: function (state) {
          return commands.lift(state)
        },
        icon: icons.lift
      }),
      new Dropdown(
        eachHeadingLevel(function (level) {
          const name = 'h' + level
          return new MenuItem({
            title: 'Heading ' + level,
            label: 'Level ' + level,
            enable: commands[name],
            run: commands[name]
          })
        }),
        { label: 'Headings' }
      ),
      new MenuItem({
        title: 'Listing',
        label: 'Listing',
        enable: commands.listing,
        run: commands.listing,
        icon: faToMenuIcon(CODE_ICON)
      })
    ],
    [
      pmMenu.undoItem,
      pmMenu.redoItem
    ]
  ]
})

function isMarkActive (state, type) {
  const empty = state.selection.empty
  const $from = state.selection.$from
  if (empty) {
    return type.isInSet(state.storedMarks || $from.marks())
  }
  const from = state.selection.from
  const to = state.selection.to
  return state.doc.rangeHasMark(from, to, type)
}

function faToMenuIcon (icon) {
  return {
    width: icon[0],
    height: icon[1],
    path: icon[4]
  }
}
