import React, { Profiler, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import Markdown, { type MarkdownSnapshot, type UpdateMeasurement, type MarkdownAnimation } from '@vali98/react-native-markdown-display'
import { CodeHighlightDemo } from './CodeHighlightDemo'
import { EditorDemo } from './EditorDemo'
import { Comparison } from './Comparison'
import { AnimationControls } from './AnimationControls'
import { StreamDelayControl } from './StreamDelayControl'
import { useStreamSample } from './useStreamSample'
import { Action, BottomControls, Disclosure, PreviewPane, ui } from './TestUI'
import { markdownTestText } from './custom/testText'
import { markdownRules } from './custom/renderRules'
import { useMarkdownStyles } from './custom/styles'

function Demo({ delay }: { delay: React.RefObject<number> }) {
  const { frame, show } = useStreamSample(markdownTestText, delay)
  const [animate, setAnimate] = useState<MarkdownAnimation>({ batchDelay: 40, fadeDuration: 220 })
  const [variant, setVariant] = useState<'basic' | 'custom'>('custom')
  const [error, setError] = useState('')
  const [timing, setTiming] = useState({ parse: 0, render: 0 })
  const pending = useRef<{ revision: number; nativeWorkMs: number } | undefined>(undefined)
  const measured = useRef('')
  const customStyles = useMarkdownStyles()
  const updated = (snapshot: MarkdownSnapshot, _measurement: UpdateMeasurement) => { pending.current = { revision: snapshot.revision, nativeWorkMs: snapshot.timings.repairMs + snapshot.timings.parseMs + snapshot.timings.reconcileMs + snapshot.timings.prepareMs } }
  const rendered = (duration: number) => {
    const update = pending.current
    if (!update) return
    const key = `${variant}:${frame.run}:${update.revision}`
    if (measured.current === key) return
    measured.current = key
    setTiming({ parse: update.nativeWorkMs, render: duration })
  }
  return <View style={ui.screen}>
    <View style={ui.header}>
      <Text style={ui.title}>Markdown preview</Text>
      <Text style={ui.caption}>Native work {timing.parse.toFixed(2)} ms  ·  React {timing.render.toFixed(2)} ms</Text>
      {!!error && <Text accessibilityRole="alert" style={{ color: '#a23050' }}>{error}</Text>}
    </View>
    <View style={ui.panes}>
      <PreviewPane title={variant === 'custom' ? 'Custom styles & rules' : 'Basic rendering'} streaming={frame.streaming} followKey={frame.run}>
        <Profiler id="preview" onRender={(_, __, duration) => rendered(duration)}>
          <Markdown typographer key={`${variant}:${frame.run}`} streaming={frame.streaming} animate={animate}
            style={variant === 'custom' ? customStyles : undefined}
            renderRules={variant === 'custom' ? markdownRules : undefined}
            onUpdate={updated} onError={value => setError(String(value))}>
            {frame.source}
          </Markdown>
        </Profiler>
      </PreviewPane>
    </View>
    <BottomControls>
      <View style={ui.row}>
        <Action title="Full text" onPress={() => { setError(''); void show(false) }} />
        <Action title={frame.streaming ? 'Restart stream' : 'Stream'} primary onPress={() => { setError(''); void show(true) }} />
        <Action title="Basic" selected={variant === 'basic'} onPress={() => { pending.current = undefined; setVariant('basic') }} />
        <Action title="Custom" selected={variant === 'custom'} onPress={() => { pending.current = undefined; setVariant('custom') }} />
      </View>
      <StreamDelayControl delay={delay} />
      <Disclosure title="Fade settings"><AnimationControls value={animate} onChange={setAnimate} /></Disclosure>
      <Disclosure title="About timings"><Text style={ui.caption}>Native work excludes queueing and delivery/waiting; it includes repair, parse/tree/ranges, reconciliation and preparation. Development/profiling timings exclude native layout and paint. The preview follows new content while streaming.</Text></Disclosure>
    </BottomControls>
  </View>
}
export default function App() {
  const streamDelay = useRef(100)
  const [tab, setTab] = useState<'native' | 'legacy' | 'editor' | 'code'>('native')
  return <SafeAreaProvider><KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'height' : 'padding'} style={ui.screen}>
    <SafeAreaView edges={['top', 'left', 'right']} style={ui.topbar}>
      <View style={ui.tabs}>
        <Action title="Preview" selected={tab === 'native'} onPress={() => setTab('native')} />
        {(Platform.OS === 'android' || Platform.OS === 'ios') && <Action title="Editor" selected={tab === 'editor'} onPress={() => setTab('editor')} />}
        <Action title="Code" selected={tab === 'code'} onPress={() => setTab('code')} />
        <Action title="Compare" selected={tab === 'legacy'} onPress={() => setTab('legacy')} />
      </View>
    </SafeAreaView>
    {tab === 'code' ? <CodeHighlightDemo /> : tab === 'editor' ? <EditorDemo /> : tab === 'native' ? <Demo delay={streamDelay} /> : <Comparison sample={markdownTestText} delay={streamDelay} />}
  </KeyboardAvoidingView></SafeAreaProvider>
}
