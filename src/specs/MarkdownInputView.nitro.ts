import type { HybridView, HybridViewProps, HybridViewMethods } from 'react-native-nitro-modules'
export interface EditorState { text: string; eventCount: number }
export interface EditorSelection { start: number; end: number }
export interface EditorChange { text: string; eventCount: number; selectionStart: number; selectionEnd: number }
export interface EditorBlock {
  kind: string; start: number; end: number; active: boolean
  x: number; y: number; width: number; height: number
}
export interface EditorLayout { text: string; eventCount: number; blocks: EditorBlock[] }
export interface EditorPreviewSize { start: number; end: number; height: number }
export interface EditorPreviewSizes { eventCount: number; sizes: EditorPreviewSize[] }
export interface MarkdownInputViewProps extends HybridViewProps {
  state: EditorState
  previewSizes: EditorPreviewSizes
  placeholder: string
  textColor: string
  delimiterColor: string
  fontSize: number
  editable: boolean
  previews: boolean
  typographer: boolean
  quoteColor: string
  linkColor: string
  onChange?: (event: EditorChange) => void
  onSelection?: (selection: EditorSelection) => void
  onBlocks?: (event: EditorLayout) => void
}
export interface MarkdownInputViewMethods extends HybridViewMethods {
  focus(): void
  blur(): void
  activate(offset: number): void
}
export type MarkdownInputView = HybridView<MarkdownInputViewProps, MarkdownInputViewMethods, { android: 'kotlin' }>
