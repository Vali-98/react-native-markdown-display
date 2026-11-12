const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = 'node_modules/react-native-markdown-display/src/lib/'
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(root + file, 'utf8'), { compilerOptions: { allowJs: true, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  new Function('require', 'exports', 'module', code)(name => name.startsWith('.') ? load(path.join(path.dirname(file), name) + '.js') : require(name), module.exports, module)
  return module.exports
}
test('legacy pipeline hooks cover actual transforms without changing output', () => {
  const parser = load('parser.js').default
  const md = require('markdown-it')().use(require('../example/custom/legacy/latexPlugin')).use(require('../example/custom/legacy/quotePlugin'))
  const source = '# Heading\n\n“quote **bold**” and $x^2$\n\n- item\n- next'
  const renderer = nodes => nodes
  const ordinary = parser(source, renderer, md)
  let performance
  const measured = parser(source, renderer, md, value => { performance = value })
  assert.deepEqual(measured, ordinary) // stable-key patch is part of the baseline
  for (const key of ['tokenizeMs', 'cleanupMs', 'groupMs', 'listTransformMs', 'astMs', 'elementsMs', 'totalMs']) {
    assert.ok(Number.isFinite(performance[key]) && performance[key] >= 0, key)
  }
})
