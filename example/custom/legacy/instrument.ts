import { MarkdownIt, renderRules as defaults, type RenderRules, type LegacyPerformance } from 'react-native-markdown-display'
import { add, type BenchmarkStats } from '../../benchmarkStats'
import { legacyRules } from './renderRules'
import latexPlugin from './latexPlugin'
import quotePlugin from './quotePlugin'
declare const performance: { now(): number }
export function createLegacyProbe(stats: BenchmarkStats, detailed: boolean) {
  const md = MarkdownIt({ typographer: true }).use(latexPlugin).use(quotePlugin)
  const parse = md.parse.bind(md)
  md.parse = (source: string, env: unknown) => {
    const start = performance.now()
    try { return parse(source, env) }
    finally { add(stats, 'markdown-it + plugins', performance.now() - start) }
  }
  if (detailed) {
    // Version-specific development probes for pinned markdown-it 10. Ruler.at
    // preserves rule ordering and invalidates markdown-it's compiled rule cache.
    for (const rule of [...md.core.ruler.__rules__]) {
      const fn = rule.fn
      md.core.ruler.at(rule.name, (state: unknown) => {
        const start = performance.now()
        try { return fn(state) }
        finally { add(stats, `core/${rule.name}`, performance.now() - start) }
      }, { alt: rule.alt })
    }
  }
  if (detailed) for (const [ruler, name] of [[md.inline.ruler, 'latex_inline'], [md.block.ruler, 'latex_block_math']]) {
    const rule = ruler.__rules__.find((entry: { name: string }) => entry.name === name)
    if (!rule) continue
    const fn = rule.fn
    ruler.at(name, (...args: unknown[]) => {
      const start = performance.now()
      try { return Reflect.apply(fn, undefined, args) }
      finally { add(stats, `syntax/${name}`, performance.now() - start) }
    }, { alt: rule.alt })
  }
  const rules: RenderRules = { ...legacyRules }
  if (detailed) for (const [name, rule] of Object.entries({ ...defaults, ...legacyRules })) {
    if (!rule) continue
    rules[name] = (...args: Parameters<NonNullable<typeof rule>>) => {
      const start = performance.now()
      try { return Reflect.apply(rule, undefined, args) }
      finally { add(stats, `element-rule/${name}`, performance.now() - start) }
    }
  }
  const onPerformance = (measurement: LegacyPerformance) => {
    ++stats.operations
    for (const [name, ms] of Object.entries(measurement)) add(stats, `pipeline/${name}`, ms)
  }
  return { md, rules, onPerformance }
}
