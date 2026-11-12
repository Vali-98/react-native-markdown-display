import React, { useRef } from 'react'
import { Text, View } from 'react-native'
import Slider from '@react-native-community/slider'
import type { MarkdownAnimation, MarkdownAnimationOptions } from '@vali98/react-native-markdown-display'
import { Action, ui } from './TestUI'

export function AnimationControls({ value, onChange }: { value: MarkdownAnimation; onChange: (value: MarkdownAnimation) => void }) {
  const saved = useRef<MarkdownAnimationOptions>({ batchDelay: 40, fadeDuration: 220 })
  if (typeof value === 'object') saved.current = value
  const settings = saved.current
  const batchDelay = settings.batchDelay ?? 40
  const fadeDuration = settings.fadeDuration ?? 220
  return <View style={{ gap: 4 }}>
    <View style={ui.row}><Action title={`Fades ${value === false ? 'off' : 'on'}`} selected={value !== false} onPress={() => onChange(value === false ? saved.current : false)} /></View>
    <Text style={ui.caption}>Grouping window · {batchDelay} ms</Text>
    <Slider accessibilityLabel="Text grouping window" style={{ height: 24 }} minimumValue={0} maximumValue={200} step={10} value={batchDelay} disabled={value === false} onValueChange={next => onChange({ ...settings, batchDelay: Math.min(Math.round(next), fadeDuration) })} minimumTrackTintColor="#7c6ee6" thumbTintColor="#7c6ee6" />
    <Text style={ui.caption}>Fade duration · {fadeDuration} ms</Text>
    <Slider accessibilityLabel="Text fade duration" style={{ height: 24 }} minimumValue={0} maximumValue={1000} step={20} value={fadeDuration} disabled={value === false} onValueChange={next => onChange({ fadeDuration: Math.round(next), batchDelay: Math.min(batchDelay, Math.round(next)) })} minimumTrackTintColor="#7c6ee6" thumbTintColor="#7c6ee6" />
    <Text style={ui.caption}>Text displays immediately. Grouping never waits for more input.</Text>
  </View>
}
