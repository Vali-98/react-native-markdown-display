import type { MarkdownDocument } from './DocumentStore'
import type { MarkdownSnapshot } from './specs/MarkdownEngine.nitro'

declare const performance: { now(): number }
export type MarkdownPerformanceEvent =
  | { type: 'request' | 'coalesced'; requestId: number; source: string; streaming: boolean }
  | { type: 'complete'; requestId: number; source: string; streaming: boolean; superseded: boolean; snapshot: MarkdownSnapshot; measurement: UpdateMeasurement }
  | { type: 'error'; requestId: number; source: string; streaming: boolean; error: unknown }
export interface UpdateMeasurement { roundTripMs: number; reused: boolean }

/** One in-flight update plus the newest pending source. Intermediate requests
 * are coalesced, but every native delta is still applied by the document store. */
export class MarkdownController {
  private version = 0
  private pending?: { version: number; source: string; streaming: boolean }
  private running = false
  private displayed?: MarkdownSnapshot
  constructor(
    private document: MarkdownDocument,
    private onSnapshot: (snapshot: MarkdownSnapshot, measurement: UpdateMeasurement) => void,
    private onError: (error: unknown) => void,
    private onPerformance?: (event: MarkdownPerformanceEvent) => void,
  ) {}
  observe(listener?: (event: MarkdownPerformanceEvent) => void) {
    this.onPerformance = listener
  }
  update(source: string, streaming: boolean) {
    const version = ++this.version
    if (this.pending) this.onPerformance?.({ type: 'coalesced', requestId: this.pending.version, source: this.pending.source, streaming: this.pending.streaming })
    this.onPerformance?.({ type: 'request', requestId: version, source, streaming })
    this.pending = { version, source, streaming }
    void this.pump()
  }
  cancel() {
    if (this.pending) this.onPerformance?.({ type: 'coalesced', requestId: this.pending.version, source: this.pending.source, streaming: this.pending.streaming })
    ++this.version
    this.pending = undefined
  }
  private async pump() {
    if (this.running) return
    this.running = true
    try {
      while (this.pending) {
        const next = this.pending
        this.pending = undefined
        try {
          // A redundant prop update needs no parsing. Mode changes still matter.
          const cached = this.displayed
          const reused = !!cached && cached.source === next.source && cached.finished === !next.streaming
          const start = performance.now()
          const snapshot = reused ? cached! : await this.document.setSource(next.source, next.streaming)
          const roundTripMs = reused ? 0 : performance.now() - start
          this.onPerformance?.({ type: 'complete', requestId: next.version, source: next.source, streaming: next.streaming, superseded: this.version !== next.version, snapshot, measurement: { roundTripMs, reused } })
          if (this.version === next.version) {
            this.displayed = snapshot
            this.onSnapshot(snapshot, { roundTripMs, reused })
          }
        } catch (error) {
          this.onPerformance?.({ type: 'error', requestId: next.version, source: next.source, streaming: next.streaming, error })
          if (this.version === next.version) this.onError(error)
        }
      }
    } finally { this.running = false }
  }
}
