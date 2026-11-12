const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const compiled = ts.transpileModule(fs.readFileSync('src/DocumentStore.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const exportsObject = {}
new Function('require', 'exports', compiled)(name => {
  if (name === 'react-native-nitro-modules') return { NitroModules: {} }
  throw new Error(`Unexpected runtime dependency: ${name}`)
}, exportsObject)
const { MarkdownDocumentStore } = exportsObject
const timings = { repairMs: 0, parseMs: 0, reconcileMs: 0, queueMs: 0, prepareMs: 0 }
const block = (id, revision = 1) => ({ id, revision, nodes: [], revealStart: 0, revealLength: 0 })
const update = (revision, changes = {}) => ({ revision, reset: false, finished: false, orderChanged: changes.order !== undefined, changed: [], removed: [], order: [], timings, ...changes })
test('unchanged block references survive tail updates and finish', () => {
  const store = new MarkdownDocumentStore()
  const one = block(1), two = block(2)
  const first = store.apply(update(1, { reset: true, changed: [one, two], order: [1, 2] }), 'one two')
  const changed = block(2, 2)
  const next = store.apply(update(2, { changed: [changed] }), 'one two!')
  assert.equal(next.blocks[0], first.blocks[0])
  assert.equal(next.blocks[1], changed)
  const final = store.apply(update(3, { finished: true }), next.source)
  assert.equal(final.blocks[0], one)
  assert.equal(final.blocks[1], changed)
})
test('removal, reordering, empty reset, stale and missing deltas', () => {
  const store = new MarkdownDocumentStore()
  store.apply(update(1, { reset: true, changed: [block(1), block(2)], order: [1, 2] }), '')
  assert.deepEqual(store.apply(update(2, { removed: [1], order: [2] }), '').blocks.map(b => b.id), [2])
  assert.throws(() => store.apply(update(2), ''), /Stale/)
  assert.throws(() => store.apply(update(4), ''), /Missing/)
  assert.deepEqual(store.apply(update(4, { reset: true }), '').blocks, [])
})

test('a non-reset delta can remove the last visible block', () => {
  const store = new MarkdownDocumentStore()
  store.apply(update(1, { reset: true, changed: [block(1)], order: [1] }), '[x]:')
  assert.deepEqual(store.apply(update(2, { removed: [1], order: [] }), '[x]: https://example.com').blocks, [])
})
