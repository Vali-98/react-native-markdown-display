export interface MarkdownAnimationOptions {
  /** Maximum grouping window in milliseconds; never delays text display. Default 40. */
  batchDelay?: number
  /** Fade lifetime in milliseconds. Zero reveals immediately. Default 220. */
  fadeDuration?: number
}
export type MarkdownAnimation = boolean | MarkdownAnimationOptions
export interface ResolvedAnimation { batchDelay: number; fadeDuration: number }
export function resolveAnimation(value: MarkdownAnimation = true): ResolvedAnimation | null {
  if (value === false) return null
  const options = typeof value === 'object' ? value : {}
  const batchDelay = options.batchDelay ?? 40
  const fadeDuration = options.fadeDuration ?? 220
  if (!Number.isFinite(batchDelay) || !Number.isFinite(fadeDuration)) throw new RangeError('Markdown animation timings must be finite milliseconds')
  const duration = Math.max(0, fadeDuration)
  return { batchDelay: Math.min(Math.max(0, batchDelay), duration), fadeDuration: duration }
}
