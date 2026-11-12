export interface RevealBatch { id: number; start: number; end: number; startedAt: number; duration: number }
export interface RevealPlan { text: string; settled: number; nextId: number; batches: RevealBatch[] }
/** Offsets are UTF-16 visible-text offsets, matching the native reveal metadata.
 * Batches expire during subsequent document updates; no animation-frame JS work. */
export function planReveal(previous: RevealPlan | undefined, text: string, revealLength: number, now: number, enabled: boolean, duration = 220, batchMs = 40): RevealPlan {
  const nextId = previous?.nextId ?? 1
  if (!enabled || duration <= 0 || (!previous && !revealLength) || (previous && !text.startsWith(previous.text))) {
    return { text, settled: text.length, nextId, batches: [] }
  }
  let settled = previous?.settled ?? 0
  const batches = (previous?.batches ?? []).filter(batch => {
    if (now - batch.startedAt >= batch.duration) { settled = Math.max(settled, batch.end); return false }
    return true
  }).map(batch => ({ ...batch }))
  let next = nextId
  const start = previous?.text.length ?? 0
  if (text.length > start) {
    if (!revealLength) { settled = text.length; batches.length = 0 }
    else {
      const last = batches[batches.length - 1]
      if (last && now - last.startedAt < Math.min(Math.max(0, batchMs), last.duration)) last.end = text.length
      else batches.push({ id: next++, start, end: text.length, startedAt: now, duration })
    }
  }
  return { text, settled, nextId: next, batches }
}
export interface RevealSlice { text: string; offset: number; batch?: RevealBatch }
export function revealSlices(plan: RevealPlan, text: string, offset: number): RevealSlice[] {
  const result: RevealSlice[] = []
  const end = offset + text.length
  let cursor = offset
  for (const batch of plan.batches) {
    if (batch.end <= cursor || batch.start >= end) continue
    if (batch.start > cursor) {
      result.push({ text: text.slice(cursor - offset, batch.start - offset), offset: cursor }); cursor = batch.start
    }
    const until = Math.min(end, batch.end)
    result.push({ text: text.slice(cursor - offset, until - offset), offset: cursor, batch }); cursor = until
  }
  if (cursor < end) result.push({ text: text.slice(cursor - offset), offset: cursor })
  return result
}
