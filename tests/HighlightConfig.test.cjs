const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const {resolveHighlightConfig} = require('../scripts/highlight-config.cjs')
function resolve(config) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-config-'))
  try {
    const file = path.join(directory, 'package.json')
    fs.writeFileSync(file, JSON.stringify({'vali-markdown': config}))
    return resolveHighlightConfig(file)
  } finally {fs.rmSync(directory, {recursive:true, force:true})}
}
test('disabled highlighting excludes both runtime and grammars', () => {
  for (const config of [{}, {enableCodeHighlight:false, codeHighlightLanguages:['python']}]) {
    const result = resolve(config)
    assert.equal(result.enabled, false)
    assert.deepEqual(result.sources, [])
    assert.deepEqual(result.defines, [])
  }
})
test('only explicitly selected languages are compiled; aliases and duplicates normalize', () => {
  const result = resolve({enableCodeHighlight:true, codeHighlightLanguages:['js','javascript','TS']})
  assert.deepEqual(result.languages, ['javascript','typescript'])
  assert.ok(result.sources.some(file => file.includes('tree-sitter-runtime')))
  assert.ok(result.sources.some(file => file.includes('typescript-parser')))
  assert.ok(result.sources.every(file => !file.includes('python-') && !file.includes('tsx-')))
})
test('an empty language set excludes the runtime too', () => {
  assert.equal(resolve({enableCodeHighlight:true, codeHighlightLanguages:[]}).enabled, false)
})
test('unknown languages and malformed flags fail with actionable errors', () => {
  assert.throws(() => resolve({enableCodeHighlight:true, codeHighlightLanguages:['does-not-exist']}), /Unsupported.*Available/)
  assert.throws(() => resolve({enableCodeHighlight:'true'}), /must be a boolean/)
  assert.throws(() => resolve({enableCodeHighlight:true, codeHighlightLanguages:'js'}), /must be an array/)
})

test('the requested expanded set includes Markdown inline support and excludes omitted languages', () => {
  const names = ['json','html','css','markdown','yaml','go','java','javascript','python','c','rust','bash','typescript','tsx','cpp']
  const result = resolve({enableCodeHighlight:true,codeHighlightLanguages:names})
  assert.equal(result.languages.length, 15)
  assert.ok(result.sources.includes('cpp/grammars/markdown-inline-parser.c'))
  assert.ok(result.sources.includes('cpp/grammars/cpp-parser.c'))
  assert.ok(result.sources.every(file => !/swift|php|ruby|c-sharp/.test(file)))
})
