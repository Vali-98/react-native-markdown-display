const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript'), fs = require('node:fs')
const React = {
  Fragment: 'Fragment', memo: value => value, useMemo: fn => fn(), useRef: value => ({ current: value }),
  createElement(type, props, ...children) {
    const next = { ...props, children }
    return typeof type === 'function' ? type(next) : { type, props: next }
  },
}
const native = { Text: 'Text', View: 'View', Image: 'Image', I18nManager: { isRTL: false }, StyleSheet: { create: value => value } }
const exportsObject = {}
const output = ts.transpileModule(fs.readFileSync('src/Markdown.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText
new Function('exports', 'require', output)(exportsObject, name => {
  if (name === 'react') return React
  if (name === 'react-native') return native
  if (name === './AnimationSettings') return { resolveAnimation: () => null }
  if (name === './RevealPlan') return { planReveal: () => ({ batches: [] }) }
  return {}
})
function node(id, parentId, type, content = '') { return { id, parentId, type, content, destination: '', marker: '', sourceStart: -1, sourceEnd: -1 } }
function render(type, mixed = false, styles = {}) {
  let resolved
  const nodes = [node('p', '', 'paragraph')]
  if (mixed) nodes.push(node('before', 'p', 'text', 'Before '))
  nodes.push(node('math', 'p', type, 'x^2'), node('value', 'math', 'text', 'x^2'))
  if (mixed) nodes.push(node('after', 'p', 'text', ' after'))
  const tree = exportsObject.MarkdownView({ snapshot: { blocks: [{ id: 1, nodes, revealLength: 0 }] }, animate: false, styles,
    rules: { [type]: context => { resolved = context.styles; return React.createElement('Math', {}) } } })
  return { tree, resolved }
}
function paths(tree, ancestors = [], found = []) {
  if (Array.isArray(tree)) { for (const item of tree) paths(item, ancestors, found); return found }
  if (!tree || typeof tree !== 'object') return found
  if (tree.type === 'Math') found.push(ancestors)
  paths(tree.props.children, [...ancestors, tree.type], found)
  return found
}
test('display math gets block layout, including inside mixed paragraphs', () => {
  for (const mixed of [false, true]) {
    const ancestors = paths(render('latex_block', mixed).tree)
    assert.equal(ancestors.length, 1)
    assert.equal(ancestors[0].includes('Text'), false, 'display math must not be constrained by a text line')
  }
})
test('inline math retains its text parent', () => {
  assert.equal(paths(render('latex_inline', true).tree)[0].includes('Text'), true)
})
test('math font sizes follow body text and respect explicit overrides', () => {
  assert.equal(render('latex_block').resolved.latex_block.fontSize, 16)
  const styles = render('latex_block', false, { paragraph: { fontSize: 28 }, latex_inline: { fontSize: 32 } }).resolved
  assert.equal(styles.latex_block.fontSize, 28)
  assert.equal(styles.latex_inline.fontSize, 32)
})
