export interface Stage { total: number; last: number; max: number; calls: number; samples: number[] }
export interface BenchmarkStats {
  inputs: number; requests: number; coalesced: number; operations: number; superseded: number; reused: number; commits: number; errors: number
  stages: Record<string, Stage>
  finalLatency?: number
}
export const createStats = (): BenchmarkStats => ({ inputs: 0, requests: 0, coalesced: 0, operations: 0, superseded: 0, reused: 0, commits: 0, errors: 0, stages: {} })
export function add(stats: BenchmarkStats, name: string, ms: number) {
  const stage = stats.stages[name] ??= { total: 0, last: 0, max: 0, calls: 0, samples: [] }
  stage.total += ms; stage.last = ms; stage.max = Math.max(stage.max, ms); ++stage.calls
  stage.samples.push(ms)
}
export function describe(stats: BenchmarkStats): string {
  const head = `${stats.inputs} inputs · ${stats.commits} React commits · ${stats.operations} operations · ${stats.errors} errors\n${stats.requests} managed requests · ${stats.coalesced} coalesced before processing · ${stats.superseded} completed but superseded · ${stats.reused} reused\nFinal source → observed commit: ${stats.finalLatency?.toFixed(2) ?? '—'} ms`
  return head + '\n' + Object.entries(stats.stages).map(([name, s]) => {
    const samples = [...s.samples].sort((a, b) => a - b)
    const percentile = (p: number) => samples[Math.max(0, Math.ceil(samples.length * p) - 1)] ?? 0
    return `${name}: total ${s.total.toFixed(2)} · avg ${(s.total / s.calls).toFixed(3)} · last ${s.last.toFixed(3)} · p95 ${percentile(.95).toFixed(3)} ms (${s.calls})`
  }).join('\n')
}
