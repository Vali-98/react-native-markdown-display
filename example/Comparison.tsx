import React, { memo, Profiler, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Action, BottomControls, Disclosure, PreviewPane, ui } from './TestUI'
import LegacyMarkdown from 'react-native-markdown-display'
import Markdown, { type MarkdownSnapshot, type UpdateMeasurement, type MarkdownPerformanceEvent, type MarkdownAnimation } from '@vali98/react-native-markdown-display'
import { useStreamSample, type SampleFrame } from './useStreamSample'
import { AnimationControls } from './AnimationControls'
import { StreamDelayControl } from './StreamDelayControl'
import { markdownRules } from './custom/renderRules'
import { useMarkdownStyles } from './custom/styles'
import { createLegacyProbe } from './custom/legacy/instrument'
import { add, createStats, describe, type BenchmarkStats } from './benchmarkStats'

declare const performance: { now(): number }
type Mode = 'native' | 'original' | 'both'
const Original = memo(function Original({ source, stats, detailed }: { source: string; stats: BenchmarkStats; detailed: boolean }) {
  const styles = useMarkdownStyles()
  const probe = useMemo(() => createLegacyProbe(stats, detailed), [stats, detailed])
  return <LegacyMarkdown markdownit={probe.md} style={styles} rules={probe.rules} onPerformance={probe.onPerformance}>{source}</LegacyMarkdown>
})
const Custom = memo(function Custom({ frame, onUpdate, onPerformance, animate }: {
  frame: SampleFrame; animate: MarkdownAnimation; onUpdate: (snapshot: MarkdownSnapshot, measurement: UpdateMeasurement) => void; onPerformance: (event: MarkdownPerformanceEvent) => void
}) {
  const styles = useMarkdownStyles()
  return <Markdown streaming={frame.streaming} animate={animate} style={styles} renderRules={markdownRules} onUpdate={onUpdate} onPerformance={onPerformance}>{frame.source}</Markdown>
})
function Meters({ original, native, mode }: { original: BenchmarkStats; native: BenchmarkStats; mode: Mode }) {
  const [summary, setSummary] = useState<{ label: string; text: string }[]>([])
  const [details, setDetails] = useState('')
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    const update = () => {
      const engines = mode === 'both' ? [['Original', original], ['New', native]] as const : mode === 'native' ? [['New', native]] as const : [['Original', original]] as const
      setSummary(engines.map(([label, stats]) => ({ label, text: `${stats.operations} operations · ${stats.commits} commits\n${(stats.stages[label === 'New' ? 'native work (measured)' : 'markdown-it + plugins']?.total ?? 0).toFixed(1)} ms ${label === 'New' ? 'native work' : 'parser'} · ${(stats.stages['React Profiler (inclusive)']?.total ?? 0).toFixed(1)} ms React` })))
      if (expanded) setDetails(engines.map(([label, stats]) => `${label.toUpperCase()}\n${describe(stats)}`).join('\n\n'))
    }
    update(); const timer = setInterval(update, 250)
    return () => clearInterval(timer)
  }, [original, native, mode, expanded])
  return <View style={ui.metrics}>
    <View style={{ flexDirection: 'row', gap: 12 }}>{summary.map(item => <View key={item.label} style={{ flex: 1 }}>
      <Text style={ui.metricLabel}>{item.label}</Text><Text style={ui.metricValue}>{item.text}</Text>
    </View>)}</View>
    <Disclosure title="Stage timings & diagnostics" onToggle={setExpanded}>
      <ScrollView style={ui.details} nestedScrollEnabled><Text selectable style={[ui.caption, { color: '#514466' }]}>{details}</Text></ScrollView>
    </Disclosure>
  </View>
}
function Run({ sample, delay, mode, detailed, options, animate }: { sample: string; delay: React.RefObject<number>; mode: Mode; detailed: boolean; options: React.ReactNode; animate: MarkdownAnimation }) {
  const { frame, show } = useStreamSample(sample, delay)
  const original = useRef(createStats()).current
  const native = useRef(createStats()).current
  const current = useRef(frame); current.current = frame
  const pending = useRef<{ snapshot: MarkdownSnapshot; measurement: UpdateMeasurement } | undefined>(undefined)
  const nativeRevision = useRef(-1)
  const finalOriginal = useRef(-1), finalNative = useRef(-1)
  const [runKey, setRunKey] = useState(0)
  useEffect(() => {
    if (mode !== 'native') ++original.inputs
    if (mode !== 'original') ++native.inputs
  }, [frame, mode, native, original])
  const nativePerformance = useCallback((event: MarkdownPerformanceEvent) => {
    if (event.type === 'request') { ++native.requests; return }
    if (event.type === 'coalesced') { ++native.coalesced; return }
    if (event.type === 'error') { ++native.errors; return }
    if (event.type !== 'complete') return
    if (event.measurement.reused) { ++native.reused; return }
    ++native.operations
    if (event.superseded) ++native.superseded
    const snapshot = event.snapshot
    const stages = snapshot.timings
    const nativeWork = stages.repairMs + stages.parseMs + stages.reconcileMs + stages.prepareMs
    add(native, 'native work (measured)', nativeWork)
    add(native, 'round-trip (all operations)', event.measurement.roundTripMs)
    for (const [name, ms] of Object.entries(snapshot.timings)) add(native, `native/${name}`, ms)
    add(native, 'JS queue', snapshot.jsQueueMs)
    add(native, 'JS store application', snapshot.storeMs)
    add(native, 'bridge elapsed', snapshot.bridgeMs)
    const workerMeasured = Object.values(snapshot.timings).reduce((sum, ms) => sum + ms, 0)
    add(native, 'bridge remainder (delivery/wait/unmeasured)', Math.max(0, snapshot.bridgeMs - workerMeasured))
  }, [native])
  const nativeUpdate = useCallback((snapshot: MarkdownSnapshot, measurement: UpdateMeasurement) => {
    pending.current = { snapshot, measurement }
  }, [])
  const committed = (engine: 'native' | 'original', duration: number, rendered: SampleFrame) => {
    if (current.current !== rendered) return
    const stats = engine === 'native' ? native : original
    // Count all React commits. These include parent/measurement-only commits.
    ++stats.commits
    add(stats, 'React Profiler (inclusive)', duration)
    if (engine === 'native') {
      const snapshot = pending.current?.snapshot
      if (!snapshot || snapshot.revision === nativeRevision.current || snapshot.source !== rendered.source || snapshot.finished === rendered.streaming) return
      nativeRevision.current = snapshot.revision
      add(stats, 'source → observed commit', performance.now() - rendered.published)
      if (!rendered.streaming && finalNative.current !== rendered.run) { finalNative.current = rendered.run; stats.finalLatency = performance.now() - rendered.published }
    } else {
      add(stats, 'source → observed commit', performance.now() - rendered.published)
      if (!rendered.streaming && finalOriginal.current !== rendered.run) { finalOriginal.current = rendered.run; stats.finalLatency = performance.now() - rendered.published }
    }
  }
  const start = (stream: boolean) => {
    // Keep the same collector objects; callbacks from superseded in-flight work
    // are still counted rather than silently lost on restart.
    pending.current = undefined; nativeRevision.current = -1
    setRunKey(value => value + 1)
    void show(stream)
  }
  return <View style={ui.screen}>
    <View style={ui.header}><Text style={ui.title}>Renderer comparison</Text><Text style={ui.caption}>{mode === 'both' ? 'Side by side · shared JS workload' : mode === 'native' ? 'New renderer · isolated' : 'Original renderer · isolated'}</Text></View>
    <Meters original={original} native={native} mode={mode} />
    <View style={ui.panes}>
      {mode !== 'native' && <PreviewPane title="Original" streaming={frame.streaming} followKey={frame.run}>
        <Profiler id="original" onRender={(_, __, duration) => committed('original', duration, frame)}>
          <Original key={runKey} source={frame.source} stats={original} detailed={detailed} />
        </Profiler>
      </PreviewPane>}
      {mode !== 'original' && <PreviewPane title="New custom" streaming={frame.streaming} followKey={frame.run}>
        <Profiler id="native" onRender={(_, __, duration) => committed('native', duration, frame)}>
          <Custom key={runKey} frame={frame} animate={animate} onUpdate={nativeUpdate} onPerformance={nativePerformance} />
        </Profiler>
      </PreviewPane>}
    </View>
    <BottomControls>
      <View style={ui.row}>
        <Action title="Full text" onPress={() => start(false)} />
        <Action title={frame.streaming ? 'Restart stream' : 'Stream'} primary onPress={() => start(true)} />
        <Action title="Clear totals" disabled={frame.streaming} onPress={() => { Object.assign(original, createStats()); Object.assign(native, createStats()) }} />
      </View>
      <StreamDelayControl delay={delay} />
      <Disclosure title="Benchmark options">
        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
        {options}
        <View style={[ui.row, { marginTop: 8 }]}><Action title="Log summary" onPress={() => console.log('Markdown benchmark', { mode, detailed, original: compactStats(original), native: compactStats(native) })} /></View>
        <Text style={[ui.caption, { marginTop: 6 }]}>Use isolated modes for latency. Detailed probes add overhead. Headline native work excludes queueing and delivery/waiting; it includes repair, parse/tree/ranges, reconciliation and preparation. Original parser covers markdown-it/plugins only. Full latency remains in diagnostics. Stage figures overlap; do not add them to React totals. Includes superseded native operations. Development timings exclude screen paint.</Text>
        </ScrollView>
      </Disclosure>
    </BottomControls>
  </View>
}
function compactStats(stats: BenchmarkStats) {
  return { inputs: stats.inputs, operations: stats.operations, commits: stats.commits, superseded: stats.superseded, coalesced: stats.coalesced, errors: stats.errors,
    stages: Object.fromEntries(Object.entries(stats.stages).map(([name, stage]) => [name, { total: stage.total, calls: stage.calls, mean: stage.total / stage.calls, max: stage.max }])) }
}
export function Comparison({ sample, delay }: { sample: string; delay: React.RefObject<number> }) {
  const [mode, setMode] = useState<Mode>('both')
  const [detailed, setDetailed] = useState(false)
  const [animate, setAnimate] = useState<MarkdownAnimation>({ batchDelay: 40, fadeDuration: 220 })
  const [session, setSession] = useState(0)
  const options = <View style={{ gap: 8 }}><View style={ui.row}>
    <Action title="Side by side" selected={mode === 'both'} onPress={() => setMode('both')} />
    <Action title="New only" selected={mode === 'native'} onPress={() => setMode('native')} />
    <Action title="Original only" selected={mode === 'original'} onPress={() => setMode('original')} />
    <Action title={`Probes ${detailed ? 'on' : 'off'}`} selected={detailed} onPress={() => setDetailed(value => !value)} />
    <Action title="Reset session" onPress={() => setSession(value => value + 1)} />
  </View><Disclosure title="Fade settings"><AnimationControls value={animate} onChange={setAnimate} /></Disclosure></View>
  return <Run key={`${mode}:${detailed}:${session}`} sample={sample} delay={delay} mode={mode} detailed={detailed} options={options} animate={animate} />
}
