import { I18nManager, processColor, StyleSheet, type ColorValue, type NativeSyntheticEvent, type StyleProp, type TextInputProps, type TextStyle } from 'react-native'
import type { EditorConfiguration, EditorInlineStyle, EditorTextAttributes } from './specs/MarkdownInputView.nitro'
import { syntaxStyles, syntaxKinds } from './SyntaxHighlighting'
import type { MarkdownStyles } from './Markdown'

/** Only implemented TextInput props are advertised; unsupported props are not silently accepted. */
export type CompatibleInputProps = Pick<TextInputProps,
  'value' | 'defaultValue' | 'onChangeText' | 'onChange' | 'onSelectionChange' |
  'onFocus' | 'onBlur' | 'onEndEditing' | 'onSubmitEditing' | 'onPress' | 'onPressIn' | 'onPressOut' |
  'onContentSizeChange' | 'onLayout' | 'style' | 'placeholder' | 'placeholderTextColor' |
  'editable' | 'readOnly' | 'multiline' | 'numberOfLines' | 'submitBehavior' | 'blurOnSubmit' |
  'returnKeyType' | 'autoFocus' | 'autoCorrect' | 'autoCapitalize' | 'keyboardType' | 'maxLength' |
  'selection' | 'selectionColor' | 'cursorColor' | 'selectTextOnFocus' | 'caretHidden' |
  'contextMenuHidden' | 'showSoftInputOnFocus' | 'scrollEnabled' | 'allowFontScaling' | 'maxFontSizeMultiplier' |
  'testID' | 'nativeID' | 'accessible' | 'accessibilityLabel' | 'accessibilityHint' | 'accessibilityState'
>

export function inputConfiguration(props: CompatibleInputProps): EditorConfiguration {
  const multiline = props.multiline ?? false
  return {
    multiline,
    submitBehavior: props.submitBehavior ?? (props.blurOnSubmit === true ? 'blurAndSubmit' : props.blurOnSubmit === false ? (multiline ? 'newline' : 'submit') : multiline ? 'newline' : 'blurAndSubmit'),
    returnKeyType: props.returnKeyType ?? 'default', autoCorrect: props.autoCorrect ?? true,
    autoCapitalize: props.autoCapitalize ?? 'sentences', keyboardType: props.keyboardType ?? 'default',
    maxLength: props.maxLength == null ? -1 : Math.max(0, Math.floor(props.maxLength)),
    numberOfLines: multiline ? Math.max(1, Math.floor(props.numberOfLines ?? 1)) : 1,
    editable: (props.editable ?? true) && !props.readOnly,
    selectTextOnFocus: props.selectTextOnFocus ?? false, caretHidden: props.caretHidden ?? false,
    contextMenuHidden: props.contextMenuHidden ?? false, showSoftInputOnFocus: props.showSoftInputOnFocus ?? true,
    scrollEnabled: props.scrollEnabled ?? true,
  }
}
export function nativeColor(value: ColorValue | undefined, fallback: string): number {
  const color = processColor(value ?? fallback)
  if (typeof color !== 'number') throw new Error('MarkdownInput requires a resolved color string or number on iOS and Android.')
  return color
}
const textKeys = new Set(['color', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textAlign', 'textAlignVertical', 'includeFontPadding', 'writingDirection', 'textDecorationLine', 'textDecorationColor', 'textDecorationStyle', 'fontVariant', 'textShadowColor', 'textShadowOffset', 'textShadowRadius'])
export function inputStyle(style: StyleProp<TextStyle>, props: Pick<CompatibleInputProps, 'allowFontScaling' | 'maxFontSizeMultiplier'>, width = 0, height = 0) {
  const flat = StyleSheet.flatten(style) ?? {}
  const rtl = flat.direction === 'rtl' || (flat.direction !== 'ltr' && I18nManager.isRTL)
  const size = (value: unknown, axis: number): number => typeof value === 'number' ? value : typeof value === 'string' && value.endsWith('%') ? parseFloat(value) / 100 * axis : 0
  const start = rtl ? flat.paddingEnd : flat.paddingStart
  const end = rtl ? flat.paddingStart : flat.paddingEnd
  const attributes: EditorTextAttributes = {
    fontFamily: flat.fontFamily ?? '', fontWeight: String(flat.fontWeight ?? 'normal'), fontStyle: flat.fontStyle ?? 'normal',
    letterSpacing: flat.letterSpacing ?? 0, lineHeight: flat.lineHeight ?? 0,
    paddingTop: size(flat.paddingTop ?? flat.paddingVertical ?? flat.padding ?? 12, height),
    paddingBottom: size(flat.paddingBottom ?? flat.paddingVertical ?? flat.padding ?? 12, height),
    paddingLeft: size(start ?? flat.paddingLeft ?? flat.paddingHorizontal ?? flat.padding ?? 12, width),
    paddingRight: size(end ?? flat.paddingRight ?? flat.paddingHorizontal ?? flat.padding ?? 12, width),
    textAlign: flat.textAlign ?? 'auto', textAlignVertical: flat.textAlignVertical ?? 'top',
    allowFontScaling: props.allowFontScaling ?? true, maxFontSizeMultiplier: props.maxFontSizeMultiplier ?? 0,
    includeFontPadding: flat.includeFontPadding ?? true,
  }
  const outer: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) if (!textKeys.has(key) && !key.startsWith('padding')) outer[key] = value
  return { outer: outer as TextStyle, attributes, color: flat.color, fontSize: flat.fontSize ?? 16 }
}

/** Adapt Nitro payloads to the same callback envelope used by TextInput. */
export function inputEvent<T extends object>(payload: T, target: number): NativeSyntheticEvent<T & { target: number }> {
  let prevented = false
  let stopped = false
  return {
    nativeEvent: { ...payload, target }, target, currentTarget: target,
    bubbles: true, cancelable: false, get defaultPrevented() { return prevented }, eventPhase: 3, isTrusted: true,
    timeStamp: Date.now(), type: 'markdownInput',
    preventDefault() { prevented = true }, stopPropagation() { stopped = true },
    isDefaultPrevented: () => prevented, isPropagationStopped: () => stopped, persist() {},
  } as unknown as NativeSyntheticEvent<T & { target: number }>
}

/** Markdown styles stay separate from TextInput's editable-source text style. */
export function inputInlineStyles(styles: MarkdownStyles | undefined): EditorInlineStyle[] {
  const kinds: Record<string, number> = { strong: 1, em: 2, s: 3, code_inline: 4, double_quote: 5, link: 6, blockquote: 7,
    heading1: 11, heading2: 12, heading3: 13, heading4: 14, heading5: 15, heading6: 16, ...syntaxKinds }
  return Object.entries(kinds).flatMap(([type, kind]) => {
    const style = styles?.[type] ?? (syntaxStyles as MarkdownStyles)[type]
    return style ? [{ kind, hasColor: style.color != null, color: nativeColor(style.color, '#000000'),
      hasBackground: style.backgroundColor != null, backgroundColor: nativeColor(style.backgroundColor, '#00000000'),
      fontSize: style.fontSize ?? 0, fontFamily: style.fontFamily ?? '', fontWeight: String(style.fontWeight ?? ''),
      fontStyle: style.fontStyle ?? '', decoration: style.textDecorationLine ?? '' }] : []
  })
}
