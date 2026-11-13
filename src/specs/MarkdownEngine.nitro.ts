import type { HybridObject } from 'react-native-nitro-modules'

// Flat preorder nodes avoid recursive types at the native boundary.
export interface MarkdownNode {
  id: string
  parentId: string
  type: string
  content: string
  destination: string
  /** Fence language tag, when supplied. */
  language?: string
  /** Rendered list marker, including ordered start and task state. */
  marker: string
  /** UTF-16 source offsets for source-backed text; -1 for synthetic/unmapped text. */
  sourceStart: number
  sourceEnd: number
}
export interface NativeTimings {
  repairMs: number
  /** MD4C, tree construction and configured code highlighting. */
  parseMs: number
  reconcileMs: number
  queueMs: number
  prepareMs: number
}
export interface MarkdownBlock {
  id: number
  revision: number
  nodes: MarkdownNode[]
  /** UTF-16 offsets in concatenated visible text, not Markdown source offsets. */
  revealStart: number
  revealLength: number
}
export interface MarkdownUpdate {
  revision: number
  finished: boolean
  reset: boolean
  changed: MarkdownBlock[]
  removed: number[]
  orderChanged: boolean
  /** Apply even an empty order when orderChanged is true or on reset. */
  order: number[]
  timings: NativeTimings
}
export interface MarkdownSnapshot {
  revision: number
  source: string
  finished: boolean
  blocks: MarkdownBlock[]
  /** JS document scheduling, native delivery, and store application. */
  jsQueueMs: number
  bridgeMs: number
  storeMs: number
  timings: NativeTimings
}
export interface MarkdownEngine extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  /** Update a managed document without resetting block identity. */
  setSource(source: string, streaming: boolean): Promise<MarkdownUpdate>
  replace(source: string): Promise<MarkdownUpdate>
  append(chunk: string): Promise<MarkdownUpdate>
  finish(): Promise<MarkdownUpdate>
}
