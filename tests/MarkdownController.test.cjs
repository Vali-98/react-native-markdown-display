const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const compiled = ts.transpileModule(fs.readFileSync('src/MarkdownController.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const exportsObject = {}
new Function('exports', compiled)(exportsObject)
const { MarkdownController } = exportsObject
const flush = () => new Promise(resolve => setImmediate(resolve))
function harness() {
  const calls = [], displayed = [], errors = [], events = []
  const document = { setSource(source, streaming) {
    return new Promise((resolve, reject) => calls.push({ source, streaming, resolve: () => resolve({ source, finished: !streaming }), reject }))
  } }
  const controller = new MarkdownController(document, value => displayed.push(value), error => errors.push(error), event => events.push(event))
  return { controller, calls, displayed, errors, events }
}
test('coalesces pending sources and never publishes superseded results', async () => {
  const h = harness()
  h.controller.update('A', true)
  h.controller.cancel()
  h.controller.update('AB', true)
  h.controller.cancel()
  h.controller.update('ABC', true)
  assert.equal(h.calls.length, 1)
  h.calls[0].resolve(); await flush()
  assert.deepEqual(h.calls.map(c => c.source), ['A', 'ABC'])
  assert.equal(h.displayed.length, 0)
  h.calls[1].resolve(); await flush()
  assert.deepEqual(h.displayed.map(s => s.source), ['ABC'])
  const completed = h.events.filter(e => e.type === 'complete')
  assert.equal(completed.length, 2)
  assert.equal(completed[0].superseded, true)
  assert.equal(completed[1].superseded, false)
  assert.equal(h.events.filter(e => e.type === 'coalesced').length, 1)
  assert.ok(completed.every(e => e.measurement.roundTripMs >= 0))
})
test('mode changes finalize exact text, redundant input does not parse', async () => {
  const h = harness()
  h.controller.update('**text', true); h.calls[0].resolve(); await flush()
  h.controller.update('**text', false)
  assert.equal(h.calls.length, 2)
  h.calls[1].resolve(); await flush()
  assert.equal(h.displayed.at(-1).finished, true)
  h.controller.update('**text', false); await flush()
  assert.equal(h.calls.length, 2)
})
test('cancel suppresses callbacks; errors do not block subsequent edits', async () => {
  const h = harness()
  h.controller.update('old', false); h.controller.cancel(); h.calls[0].resolve(); await flush()
  assert.equal(h.displayed.length, 0)
  h.controller.update('bad', false); h.calls[1].reject(new Error('failed')); await flush()
  assert.equal(h.errors.length, 1)
  h.controller.update('edited', false); h.calls[2].resolve(); await flush()
  assert.equal(h.displayed[0].source, 'edited')
})
