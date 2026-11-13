import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { findNodeHandle, PixelRatio, StyleSheet, View, type TextInput, type ColorValue, type StyleProp, type TextStyle, type ViewStyle, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import { callback } from 'react-native-nitro-modules'
import { Markdown, type MarkdownStyles, type RenderRules } from './Markdown'
import { inputConfiguration, inputEvent, inputInlineStyles, inputStyle, nativeColor, type CompatibleInputProps } from './InputCompatibility'
import type { EditorChange, EditorEvent, EditorFocus, EditorLayout, EditorMetrics, EditorSelection, EditorTouch, MarkdownInputView } from './specs/MarkdownInputView.nitro'
import { NativeMarkdownInputView } from './NativeMarkdownInputView'

// RN's focus registry also coordinates Keyboard.dismiss() and ScrollView taps.
const inputState = require('react-native/Libraries/Components/TextInput/TextInputState').default as {
  registerInput(view: unknown): void; unregisterInput(view: unknown): void
  focusInput(view: unknown): void; blurInput(view: unknown): void
}

function previewSource(source: string, kind: string): string {
  if (kind !== 'latex_block') return source
  const open = source.indexOf('\\[')
  if (open < 0) return source
  const close = source.lastIndexOf('\\]')
  return source.slice(0, open) + '$$' + source.slice(open + 2, close >= 0 ? close : undefined) + '$$' + (close >= 0 ? source.slice(close + 2) : '')
}

export interface MarkdownInputRef extends Pick<TextInput, 'focus' | 'blur' | 'clear' | 'isFocused' | 'setSelection' | 'measure' | 'measureInWindow' | 'measureLayout' | 'setNativeProps'> {
  activate(offset: number): void
  getNativeRef(): View | null
  getAnimatableRef(): View | null
}
export interface MarkdownInputProps extends CompatibleInputProps {
  /** Editable-source text styles. Text fields in style remain supported for compatibility. */
  textStyle?: StyleProp<TextStyle>
  /** Outer container only: borders, background and layout. */
  viewStyle?: StyleProp<ViewStyle>
  markdownStyle?: MarkdownStyles
  renderRules?: RenderRules
  /** Alias for style.color. */
  textColor?: ColorValue
  delimiterColor?: ColorValue
  /** Alias for style.fontSize. */
  fontSize?: number
  /** False shows unstyled source. */
  previews?: boolean
  /** Display-only substitutions; the controlled value stays unchanged. */
  typographer?: boolean
}
/** Android Markdown editing with a compatible subset of TextInput props. */
export const MarkdownInput = forwardRef<MarkdownInputRef, MarkdownInputProps>(function MarkdownInput(props, forwardedRef) {
  const NativeInput = NativeMarkdownInputView
  if (!NativeInput) throw new Error('MarkdownInput currently supports Android only.')
  const { style, markdownStyle, renderRules, placeholder = '', delimiterColor, previews = true, typographer = false } = props
  const native = useRef<MarkdownInputView | null>(null)
  const wrapper = useRef<View>(null)
  const nativeHost = useRef<View | null>(null)
  const latest = useRef(props)
  latest.current = props
  const [uncontrolledValue, setUncontrolledValue] = useState(props.defaultValue ?? '')
  const value = props.value ?? uncontrolledValue
  const target = useRef(0)
  const count = useRef(0)
  const [eventCount, setEventCount] = useState(0)
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  const [preferredHeight, setPreferredHeight] = useState(0)
  const [layout, setLayout] = useState<EditorLayout>({ text: '', eventCount: 0, blocks: [] })
  const [measured, setMeasured] = useState({ text: value, eventCount: 0, sizes: [] as { start: number; end: number; height: number }[] })
  const resolved = useMemo(() => inputStyle([style, props.textStyle], props, frame.width, frame.height), [style, props.textStyle, props.allowFontScaling, props.maxFontSizeMultiplier, frame.width, frame.height])
  const textColor = props.textColor ?? resolved.color ?? '#202124'
  const fontSize = props.fontSize ?? resolved.fontSize
  const configuration = useMemo(() => inputConfiguration(props), [props.multiline, props.submitBehavior, props.blurOnSubmit, props.returnKeyType, props.autoCorrect, props.autoCapitalize, props.keyboardType, props.maxLength, props.numberOfLines, props.editable, props.readOnly, props.selectTextOnFocus, props.caretHidden, props.contextMenuHidden, props.showSoftInputOnFocus, props.scrollEnabled])
  const scale = resolved.attributes.allowFontScaling ? Math.min(PixelRatio.getFontScale(), resolved.attributes.maxFontSizeMultiplier >= 1 ? resolved.attributes.maxFontSizeMultiplier : Infinity) : 1
  const estimatedHeight = (resolved.attributes.lineHeight || fontSize * scale * 1.2) * configuration.numberOfLines + resolved.attributes.paddingTop + resolved.attributes.paddingBottom
  const outerStyle = StyleSheet.flatten([resolved.outer, props.viewStyle])
  const intrinsicSize = outerStyle.height == null && outerStyle.flex == null && outerStyle.flexGrow == null ? { minHeight: preferredHeight || estimatedHeight } : { minHeight: 0 }
  const controlledSelection = useMemo(() => ({ start: props.selection?.start ?? -1, end: props.selection?.end ?? props.selection?.start ?? -1 }), [props.selection?.start, props.selection?.end])
  useImperativeHandle(forwardedRef, () => ({
    focus: () => native.current?.focus(), blur: () => native.current?.blur(),
    isFocused: () => native.current?.isFocused() ?? false,
    clear: () => { setUncontrolledValue(''); native.current?.clear() },
    setSelection: (start, end) => native.current?.setSelection(start, end),
    activate: offset => native.current?.activate(offset),
    getNativeRef: () => nativeHost.current,
    getAnimatableRef: () => wrapper.current,
    measure: (...args) => wrapper.current?.measure(...args),
    measureInWindow: (...args) => wrapper.current?.measureInWindow(...args),
    measureLayout: (...args) => wrapper.current?.measureLayout(...args),
    setNativeProps: value => wrapper.current?.setNativeProps(value),
  }), [])
  const setHost = useCallback((host: View | null) => {
    if (nativeHost.current) { inputState.blurInput(nativeHost.current); inputState.unregisterInput(nativeHost.current) }
    nativeHost.current = host
    if (host) { target.current = findNodeHandle(host) ?? 0; inputState.registerInput(host) }
  }, [])
  const changed = useCallback((event: EditorChange) => {
    count.current = event.eventCount; target.current = event.target
    setEventCount(event.eventCount)
    if (latest.current.value === undefined) setUncontrolledValue(event.text)
    latest.current.onChange?.(inputEvent({ text: event.text, eventCount: event.eventCount }, event.target))
    latest.current.onChangeText?.(event.text)
  }, [])
  const blocks = useCallback((event: EditorLayout) => { if (event.eventCount >= count.current) setLayout(event) }, [])
  const selected = useCallback((selection: EditorSelection) => {
    latest.current.onSelectionChange?.(inputEvent({ selection }, target.current))
  }, [])
  const focusChanged = useCallback((event: EditorFocus) => {
    target.current = event.target
    if (event.focused) {
      inputState.focusInput(nativeHost.current)
      latest.current.onFocus?.(inputEvent({ text: event.text, eventCount: event.eventCount }, event.target))
    } else {
      inputState.blurInput(nativeHost.current)
      latest.current.onBlur?.(inputEvent({ text: event.text, eventCount: event.eventCount }, event.target))
      latest.current.onEndEditing?.(inputEvent({ text: event.text }, event.target))
    }
  }, [])
  const submitted = useCallback((event: EditorEvent) => latest.current.onSubmitEditing?.(inputEvent({ text: event.text }, event.target)), [])
  const touched = useCallback((event: EditorTouch) => {
    target.current = event.target
    const touch = { identifier: '0', locationX: event.x, locationY: event.y, pageX: event.pageX, pageY: event.pageY, timestamp: event.timestamp, target: event.target, touches: [], changedTouches: [] }
    const envelope = inputEvent({ ...touch, touches: event.phase === 'end' ? [] : [touch], changedTouches: [touch] }, event.target) as unknown as GestureResponderEvent
    if (event.phase === 'start') latest.current.onPressIn?.(envelope)
    else if (event.phase === 'end') latest.current.onPressOut?.(envelope)
    else latest.current.onPress?.(envelope)
  }, [])
  const metrics = useCallback((event: EditorMetrics) => {
    target.current = event.target
    setPreferredHeight(previous => Math.abs(previous - event.preferredHeight) > 0.5 ? event.preferredHeight : previous)
    latest.current.onContentSizeChange?.(inputEvent({ contentSize: { width: event.width, height: event.height } }, event.target))
  }, [])
  const laidOut = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setFrame(previous => previous.width === width && previous.height === height ? previous : { width, height })
    latest.current.onLayout?.(event)
  }, [])
  const ref = useCallback((view: MarkdownInputView) => { native.current = view; if (latest.current.autoFocus) view.focus() }, [])
  const state = useMemo(() => ({ text: value, eventCount }), [value, eventCount])
  const previewSizes = measured.eventCount === eventCount && measured.text === value ? measured : { eventCount, sizes: [] }
  const inlineStyles = useMemo(() => inputInlineStyles(markdownStyle), [markdownStyle])
  const seen = new Map<string, number>()
  const visibleBlocks = layout.blocks.filter(block => !block.active).map(block => {
    const content = layout.text.slice(block.start, block.end)
    const identity = `${block.kind}:${content}`
    const occurrence = seen.get(identity) ?? 0
    seen.set(identity, occurrence + 1)
    return { ...block, content, key: `${identity}:${occurrence}` }
  })
  return <View ref={wrapper} style={[styles.container, intrinsicSize, outerStyle]} onLayout={laidOut}>
    <NativeInput ref={setHost} style={StyleSheet.absoluteFill}
      testID={props.testID} nativeID={props.nativeID} accessible={props.accessible}
      accessibilityLabel={props.accessibilityLabel} accessibilityHint={props.accessibilityHint} accessibilityState={props.accessibilityState} hybridRef={callback(ref)} state={state}
      previewSizes={previewSizes} placeholder={placeholder} textColor={nativeColor(textColor, '#202124')}
      placeholderColor={nativeColor(props.placeholderTextColor, '#92979f')}
      selectionColor={nativeColor(props.selectionColor, '#8876c0')}
      cursorColor={nativeColor(props.cursorColor ?? props.selectionColor, '#8876c0')}
      configuration={configuration} textAttributes={resolved.attributes} selectionState={controlledSelection} inlineStyles={inlineStyles}
      delimiterColor={nativeColor(delimiterColor, '#92979f')} fontSize={fontSize} previews={previews} typographer={typographer}
      quoteColor={nativeColor(markdownStyle?.double_quote?.color, '#8a4b9d')}
      linkColor={nativeColor(markdownStyle?.link?.color, '#2674d9')}
      onChange={callback(changed)} onBlocks={callback(blocks)} onSelection={callback(props.onSelectionChange ? selected : undefined)}
      onFocusChanged={callback(focusChanged)} onSubmit={callback(submitted)} onMetrics={callback(metrics)}
      onTouch={callback(props.onPress || props.onPressIn || props.onPressOut ? touched : undefined)} />
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
          <Markdown streaming animate={false} typographer={typographer} style={markdownStyle} renderRules={renderRules}>{previewSource(block.content, block.kind)}</Markdown>
        </View>
      </View>)}
  </View>
})
const styles = StyleSheet.create({ container: { overflow: 'hidden' } })
