const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), ts = require('typescript')
const output = ts.transpileModule(fs.readFileSync('src/AnimationSettings.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const exportsObject = {}
new Function('exports', output)(exportsObject)
const { resolveAnimation } = exportsObject

test('defaults, disable, and grouping window cap', () => {
  assert.deepEqual(resolveAnimation(), { batchDelay: 40, fadeDuration: 220 })
  assert.equal(resolveAnimation(false), null)
  assert.deepEqual(resolveAnimation({ batchDelay: 500, fadeDuration: 100 }), { batchDelay: 100, fadeDuration: 100 })
  assert.deepEqual(resolveAnimation({ batchDelay: -1, fadeDuration: -2 }), { batchDelay: 0, fadeDuration: 0 })
})
test('non-finite timing values are rejected', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => resolveAnimation({ batchDelay: value }), RangeError)
    assert.throws(() => resolveAnimation({ fadeDuration: value }), RangeError)
  }
})
