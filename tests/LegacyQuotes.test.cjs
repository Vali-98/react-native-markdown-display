const { test } = require('node:test')
const assert = require('node:assert/strict')
const MarkdownIt = require('markdown-it')
const quotePlugin = require('../example/custom/legacy/quotePlugin')
const latexPlugin = require('../example/custom/legacy/latexPlugin')
function inspect(source) {
  const tokens = new MarkdownIt().use(latexPlugin).use(quotePlugin).parse(source, {})
  let maxDepth = 0, visible = ''
  for (const block of tokens) {
    const stack = []
    let depth = 0
    for (const token of block.children ?? []) {
      if (token.nesting === 1) {
        stack.push(token.type.replace(/_open$/, ''))
        if (token.type === 'double_quote_open') maxDepth = Math.max(maxDepth, ++depth)
      } else if (token.nesting === -1) {
        assert.equal(stack.pop(), token.type.replace(/_close$/, ''))
        if (token.type === 'double_quote_close') --depth
      }
      if (token.type === 'text') visible += token.content
    }
    assert.deepEqual(stack, [])
  }
  return { maxDepth, visible }
}
test('quote test 8 preserves four levels and original punctuation', () => {
  const source = '“1 “2 “3 “4” 3” 2” 1”'
  assert.deepEqual(inspect(source), { maxDepth: 4, visible: source })
  for (let i = 1; i <= source.length; ++i) inspect(source.slice(0, i))
})
test('quote boundaries cannot cross emphasis nesting', () => {
  for (const source of ['"Test *"*', '"Test _"_ test', '“outer **bold “inner”** outer”', '“mixed "ascii" inside”']) inspect(source)
})
test('code and math remain excluded', () => {
  assert.equal(inspect('`"code"` $"math"$').maxDepth, 0)
})
