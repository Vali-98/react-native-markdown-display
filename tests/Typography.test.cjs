const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript'), fs = require('node:fs')
const output = ts.transpileModule(fs.readFileSync('src/Typography.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const moduleExports = {}
new Function('exports', output)(moduleExports)
const { typographicText } = moduleExports
const legacy = require('markdown-it')({ typographer: true }).disable('smartquotes')
for (const text of [
  '(c) (C) (r) (R) (tm) (TM) (p) (P) +-',
  'test.. test... test..... test?..... test!....',
  '!!!!!! ???? ,,  -- ---',
  'one--two one---two ---- a-- b a --b !?!???',
]) test(`typography matches legacy: ${text}`, () => {
  assert.equal(typographicText(text), legacy.renderInline(text))
})
test('display transformation leaves source intact', () => {
  const source = '(c) ...'
  assert.equal(typographicText(source), '© …')
  assert.equal(source, '(c) ...')
})
