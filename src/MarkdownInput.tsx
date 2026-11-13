import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { callback } from 'react-native-nitro-modules'
import { Markdown, type MarkdownStyles, type RenderRules } from './Markdown'
import type { EditorChange, EditorLayout, EditorSelection, MarkdownInputView } from './specs/MarkdownInputView.nitro'
import { NativeMarkdownInputView } from './NativeMarkdownInputView'

function previewSource(source: string, kind: string): string {
  if (kind !== 'latex_block') return source
  const open = source.indexOf('\\[')
  if (open < 0) return source
  const close = source.lastIndexOf('\\]')
  return source.slice(0, open) + '$$' + source.slice(open + 2, close >= 0 ? close : undefined) + '$$' + (close >= 0 ? source.slice(close + 2) : '')
}

export interface MarkdownInputRef { focus(): void; blur(): void; activate(offset: number): void }
export interface MarkdownInputProps {
  value: string
  onChangeText: (value: string) => void
  style?: StyleProp<ViewStyle>
  markdownStyle?: MarkdownStyles
  renderRules?: RenderRules
  placeholder?: string
  textColor?: string
  delimiterColor?: string
  fontSize?: number
  editable?: boolean
  /** Styled editing and inactive block previews. False shows unstyled source. */
  previews?: boolean
  /** Display-only typography; the controlled Markdown value stays unchanged. */
  typographer?: boolean
  onSelectionChange?: (selection: EditorSelection) => void
}
/** Android source editor with native inline styling and React block previews. */
export const MarkdownInput = forwardRef<MarkdownInputRef, MarkdownInputProps>(function MarkdownInput({
  value, onChangeText, style, markdownStyle, renderRules, placeholder = '',
  textColor = '#202124', delimiterColor = '#92979f', fontSize = 16, editable = true, previews = true, typographer = false, onSelectionChange,
}, forwardedRef) {
  const NativeInput = NativeMarkdownInputView
  if (!NativeInput) throw new Error('MarkdownInput currently supports Android only.')
  const native = useRef<MarkdownInputView | null>(null)
  const latest = useRef({ onChangeText, onSelectionChange })
  latest.current = { onChangeText, onSelectionChange }
  const count = useRef(0)
  const [eventCount, setEventCount] = useState(0)
  const [layout, setLayout] = useState<EditorLayout>({ text: '', eventCount: 0, blocks: [] })
  const [measured, setMeasured] = useState({ text: value, eventCount: 0, sizes: [] as { start: number; end: number; height: number }[] })
  useImperativeHandle(forwardedRef, () => ({
    focus: () => native.current?.focus(), blur: () => native.current?.blur(),
    activate: offset => native.current?.activate(offset),
  }), [])
  const changed = useCallback((event: EditorChange) => {
    count.current = event.eventCount
    setEventCount(event.eventCount)
    latest.current.onChangeText(event.text)
  }, [])
  const blocks = useCallback((event: EditorLayout) => {
    if (event.eventCount >= count.current) setLayout(event)
  }, [])
  const selection = useCallback((event: EditorSelection) => latest.current.onSelectionChange?.(event), [])
  const ref = useCallback((view: MarkdownInputView) => { native.current = view }, [])
  const state = useMemo(() => ({ text: value, eventCount }), [value, eventCount])
  const previewSizes = measured.eventCount === eventCount && measured.text === value ? measured : { eventCount, sizes: [] }
  const previewStyles = useMemo(() => ({
    ...markdownStyle,
    paragraph: { fontSize, color: textColor, ...markdownStyle?.paragraph },
  }), [markdownStyle, fontSize, textColor])
  const seen = new Map<string, number>()
  const visibleBlocks = layout.blocks.filter(block => !block.active).map(block => {
    const content = layout.text.slice(block.start, block.end)
    const identity = `${block.kind}:${content}`
    const occurrence = seen.get(identity) ?? 0
    seen.set(identity, occurrence + 1)
    return { ...block, content, key: `${identity}:${occurrence}` }
  })
  return <View style={[styles.container, style]}>
    <NativeInput style={StyleSheet.absoluteFill} hybridRef={callback(ref)} state={state}
      previewSizes={previewSizes} placeholder={placeholder} textColor={textColor}
      delimiterColor={delimiterColor} fontSize={fontSize} editable={editable} previews={previews} typographer={typographer}
      quoteColor={typeof markdownStyle?.double_quote?.color === 'string' ? markdownStyle.double_quote.color : '#8a4b9d'}
      linkColor={typeof markdownStyle?.link?.color === 'string' ? markdownStyle.link.color : '#2674d9'}
      onChange={callback(changed)} onBlocks={callback(blocks)} onSelection={callback(onSelectionChange ? selection : undefined)} />
    {previews && visibleBlocks.map(block =>
      <View key={block.key} pointerEvents="none"
        style={{ position: 'absolute', left: block.x, top: block.y, width: block.width }}>
        <View pointerEvents="none" onLayout={event => {
          const height = Math.ceil(event.nativeEvent.layout.height)
          if (count.current !== layout.eventCount || height <= 0) return
          setMeasured(previous => {
            const sizes = previous.eventCount === layout.eventCount && previous.text === layout.text ? previous.sizes : []
            if (sizes.some(size => size.start === block.start && size.end === block.end && size.height === height)) return previous
            return { text: layout.text, eventCount: layout.eventCount, sizes: [...sizes.filter(size => size.start !== block.start || size.end !== block.end), { start: block.start, end: block.end, height }] }
          })
        }}>
          <Markdown streaming animate={false} typographer={typographer} style={previewStyles} renderRules={renderRules}>{previewSource(block.content, block.kind)}</Markdown>
        </View>
      </View>)}
  </View>
})
const styles = StyleSheet.create({ container: { minHeight: 240, overflow: 'hidden' } })
