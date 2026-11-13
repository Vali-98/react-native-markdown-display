import type { HybridView, HybridViewProps, HybridViewMethods } from 'react-native-nitro-modules'
export interface EditorState { text: string; eventCount: number }
export interface EditorSelection { start: number; end: number }
export interface EditorEvent { text: string; eventCount: number; target: number }
export interface EditorChange extends EditorEvent { selectionStart: number; selectionEnd: number }
export interface EditorFocus extends EditorEvent { focused: boolean }
export interface EditorTouch { phase: string; x: number; y: number; pageX: number; pageY: number; timestamp: number; target: number }
export interface EditorMetrics { width: number; height: number; preferredHeight: number; target: number }
export interface EditorConfiguration {
  multiline: boolean
  submitBehavior: string
  returnKeyType: string
  autoCorrect: boolean
  autoCapitalize: string
  keyboardType: string
  maxLength: number
  numberOfLines: number
  editable: boolean
  selectTextOnFocus: boolean
  caretHidden: boolean
  contextMenuHidden: boolean
  showSoftInputOnFocus: boolean
  scrollEnabled: boolean
}
export interface EditorTextAttributes {
  fontFamily: string; fontWeight: string; fontStyle: string
  letterSpacing: number; lineHeight: number
  paddingTop: number; paddingBottom: number; paddingLeft: number; paddingRight: number
  textAlign: string; textAlignVertical: string
  allowFontScaling: boolean; maxFontSizeMultiplier: number; includeFontPadding: boolean
}
export interface EditorInlineStyle {
  kind: number; hasColor: boolean; color: number; hasBackground: boolean; backgroundColor: number
  fontSize: number; fontFamily: string; fontWeight: string; fontStyle: string; decoration: string
}
export interface EditorBlock {
  kind: string; start: number; end: number; active: boolean
  x: number; y: number; width: number; height: number
}
export interface EditorLayout { text: string; eventCount: number; blocks: EditorBlock[] }
export interface EditorPreviewSize { start: number; end: number; height: number }
export interface EditorPreviewSizes { eventCount: number; sizes: EditorPreviewSize[] }
export interface MarkdownInputViewProps extends HybridViewProps {
  state: EditorState
  selectionState: EditorSelection
  inlineStyles: EditorInlineStyle[]
  configuration: EditorConfiguration
  textAttributes: EditorTextAttributes
  previewSizes: EditorPreviewSizes
  placeholder: string
  textColor: number
  placeholderColor: number
  selectionColor: number
  cursorColor: number
  delimiterColor: number
  fontSize: number
  previews: boolean
  typographer: boolean
  quoteColor: number
  linkColor: number
  onChange?: (event: EditorChange) => void
  onSelection?: (selection: EditorSelection) => void
  onBlocks?: (event: EditorLayout) => void
  onFocusChanged?: (event: EditorFocus) => void
  onSubmit?: (event: EditorEvent) => void
  onTouch?: (event: EditorTouch) => void
  onMetrics?: (event: EditorMetrics) => void
}
export interface MarkdownInputViewMethods extends HybridViewMethods {
  focus(): void
  blur(): void
  isFocused(): boolean
  clear(): void
  setSelection(start: number, end: number): void
  activate(offset: number): void
}
export type MarkdownInputView = HybridView<MarkdownInputViewProps, MarkdownInputViewMethods, { android: 'kotlin' }>
