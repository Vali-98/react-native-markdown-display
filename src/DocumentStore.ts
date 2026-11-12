import { NitroModules } from 'react-native-nitro-modules'
import type { MarkdownBlock, MarkdownEngine, MarkdownSnapshot, MarkdownUpdate } from './specs/MarkdownEngine.nitro'

declare const performance: { now(): number }

/** Applies ordered native deltas without cloning unchanged blocks. */
export class MarkdownDocumentStore {
  private blocks = new Map<number, MarkdownBlock>()
  private order: number[] = []
  private revision = 0
  apply(update: MarkdownUpdate, source: string): MarkdownSnapshot {
    if (update.revision <= this.revision) throw new Error('Stale Markdown update')
    if (!update.reset && update.revision !== this.revision + 1) throw new Error('Missing Markdown update; replace the document to reset it')
    if (update.reset) this.blocks.clear()
    for (const id of update.removed) this.blocks.delete(id)
    for (const block of update.changed) this.blocks.set(block.id, block)
    if (update.reset || update.orderChanged) this.order = update.order
    this.revision = update.revision
    const blocks = this.order.map(id => {
      const block = this.blocks.get(id)
      if (!block) throw new Error(`Missing Markdown block ${id}`)
      return block
    })
    return { revision: update.revision, source, finished: update.finished, blocks, jsQueueMs: 0, bridgeMs: 0, storeMs: 0, timings: update.timings }
  }
}

export interface MarkdownDocument {
  setSource(source: string, streaming?: boolean): Promise<MarkdownSnapshot>
  replace(source: string): Promise<MarkdownSnapshot>
  append(chunk: string): Promise<MarkdownSnapshot>
  finish(): Promise<MarkdownSnapshot>
}
export function createMarkdownDocument(): MarkdownDocument {
  const engine = NitroModules.createHybridObject<MarkdownEngine>('MarkdownEngine')
  const store = new MarkdownDocumentStore()
  let source = ''
  // Apply every delta, even if the caller chooses not to display every snapshot.
  // Serialize application as well as native operations, including failed calls.
  let pending: Promise<unknown> = Promise.resolve()
  function schedule(operation: () => Promise<MarkdownUpdate>, nextSource: () => string): Promise<MarkdownSnapshot> {
    const queued = performance.now()
    const result = pending.then(async () => {
      const started = performance.now()
      const update = await operation()
      const delivered = performance.now()
      source = nextSource()
      const snapshot = store.apply(update, source)
      snapshot.jsQueueMs = started - queued
      snapshot.bridgeMs = delivered - started
      snapshot.storeMs = performance.now() - delivered
      return snapshot
    })
    pending = result.catch(() => {})
    return result
  }
  return {
    setSource: (value, streaming = false) => schedule(() => engine.setSource(value, streaming), () => value),
    replace: value => schedule(() => engine.replace(value), () => value),
    append: chunk => schedule(() => engine.append(chunk), () => source + chunk),
    finish: () => schedule(() => engine.finish(), () => source),
  }
}
