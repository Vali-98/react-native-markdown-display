const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript'), fs = require('node:fs')
const output = ts.transpileModule(fs.readFileSync('src/RevealPlan.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const moduleExports = {}
new Function('exports', output)(moduleExports)
const { planReveal, revealSlices } = moduleExports

test('static text stays settled; streamed appends preserve the old prefix', () => {
  const initial = planReveal(undefined, 'Hello', 0, 100, true)
  assert.equal(initial.batches.length, 0)
  const next = planReveal(initial, 'Hello world', 6, 200, true)
  const slices = revealSlices(next, 'Hello world', 0)
  assert.equal(slices[0].text, 'Hello')
  assert.equal(slices[0].batch, undefined)
  assert.equal(slices[1].text, ' world')
  assert.equal(slices[1].batch.startedAt, 200)
})
test('fast chunks share a batch; completed history is bounded', () => {
  let plan
  for (let i = 1; i <= 1000; ++i) plan = planReveal(plan, 'x'.repeat(i), 1, 100 + i * 5, true)
  assert.ok(plan.batches.length <= 7)
  assert.ok(plan.settled > 900)
  assert.equal(plan.batches.at(-1).end, 1000)
  const first = planReveal(undefined, 'a', 1, 100, true)
  const second = planReveal(first, 'ab', 1, 120, true)
  assert.equal(second.batches[0].id, first.batches[0].id)
  assert.equal(second.batches[0].startedAt, 100)
})
test('format changes retain reveal times; edits/animation off settle existing text', () => {
  const initial = planReveal(undefined, 'word', 4, 100, true)
  const formatted = planReveal(initial, 'word', 0, 150, true)
  assert.equal(formatted.batches[0].startedAt, 100)
  assert.equal(planReveal(formatted, 'different', 0, 160, true).batches.length, 0)
  assert.equal(planReveal(formatted, 'word', 0, 160, false).batches.length, 0)
})
test('slices preserve Unicode and spans crossing formatting leaves', () => {
  const plan = planReveal(undefined, '😀 bold', 7, 100, true)
  const a = revealSlices(plan, '😀 ', 0), b = revealSlices(plan, 'bold', 3)
  assert.equal(a.map(s => s.text).join('') + b.map(s => s.text).join(''), '😀 bold')
  assert.equal(a[0].batch.id, b[0].batch.id)
})

test('each batch keeps its duration when settings change', () => {
  const first = planReveal(undefined, 'a', 1, 100, true, 220, 40)
  const next = planReveal(first, 'ab', 1, 200, true, 500, 40)
  assert.equal(next.batches[0].duration, 220)
  assert.equal(next.batches[1].duration, 500)
  assert.equal(next.batches[0].startedAt, 100)
})
test('zero grouping creates distinct batches and zero duration settles immediately', () => {
  const first = planReveal(undefined, 'a', 1, 100, true, 220, 0)
  assert.equal(planReveal(first, 'ab', 1, 101, true, 220, 0).batches.length, 2)
  assert.equal(planReveal(first, 'ab', 1, 101, true, 0, 40).batches.length, 0)
})
