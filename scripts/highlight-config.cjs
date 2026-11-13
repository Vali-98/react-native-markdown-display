const fs = require('node:fs')
const path = require('node:path')
const aliases = { js: 'javascript', jsx: 'javascript', ts: 'typescript', py: 'python', md: 'markdown', yml: 'yaml', sh: 'bash', shell: 'bash', zsh: 'bash', golang: 'go', rs: 'rust', cc: 'cpp', cxx: 'cpp' }
const grammars = {
  html: ["html-parser.c", "html-scanner.c"],
  css: ["css-parser.c", "css-scanner.c"],
  go: ["go-parser.c"],
  java: ["java-parser.c"],
  c: ["c-parser.c"],
  rust: ["rust-parser.c", "rust-scanner.c"],
  bash: ["bash-parser.c", "bash-scanner.c"],
  cpp: ["cpp-parser.c", "cpp-scanner.c"],
  yaml: ["yaml-parser.c", "yaml-scanner.c"],
  markdown: ["markdown-parser.c", "markdown-scanner.c", "markdown-inline-parser.c", "markdown-inline-scanner.c"],

  javascript: ['javascript-parser.c', 'javascript-scanner.c'],
  typescript: ['typescript-parser.c', 'typescript-scanner.c'],
  tsx: ['tsx-parser.c', 'tsx-scanner.c'],
  python: ['python-parser.c', 'python-scanner.c'],
  json: ['json-parser.c'],
}
function resolveHighlightConfig(packagePath) {
  const app = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  const config = app['vali-markdown'] ?? {}
  if (config.enableCodeHighlight != null && typeof config.enableCodeHighlight !== 'boolean') throw new Error('vali-markdown.enableCodeHighlight must be a boolean')
  const enabled = config.enableCodeHighlight ?? false
  const configured = config.codeHighlightLanguages ?? ['javascript', 'typescript', 'python', 'json']
  if (!Array.isArray(configured) || configured.some(language => typeof language !== 'string')) throw new Error('vali-markdown.codeHighlightLanguages must be an array of language names')
  const languages = enabled ? [...new Set(configured.map(language => aliases[language.toLowerCase()] ?? language.toLowerCase()))] : []
  for (const language of languages) if (!grammars[language]) throw new Error(`Unsupported code highlight language "${language}". Available: ${Object.keys(grammars).join(', ')}`)
  const sources = enabled && languages.length ? ['tree-sitter-runtime.c', ...languages.flatMap(language => grammars[language])].map(file => `cpp/grammars/${file}`) : []
  return { enabled: enabled && languages.length > 0, languages, sources,
    defines: sources.length ? ['VALI_CODE_HIGHLIGHT=1', ...languages.map(language => `VALI_TS_${language.toUpperCase()}=1`)] : [] }
}
module.exports = { resolveHighlightConfig }
if (require.main === module) {
  try { process.stdout.write(JSON.stringify(resolveHighlightConfig(path.resolve(process.argv[2] ?? 'package.json')))) }
  catch (error) { console.error(`Markdown highlighting configuration: ${error.message}`); process.exitCode = 1 }
}
