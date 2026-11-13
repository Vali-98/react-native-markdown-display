import React, { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Image, I18nManager, Linking, StyleSheet, Text, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import { resolveAnimation, type MarkdownAnimation, type ResolvedAnimation } from './AnimationSettings'
import { syntaxStyles } from './SyntaxHighlighting'
import { typographicText } from './Typography'
import { RevealText, RevealBlock } from './Reveal'
import { planReveal, revealSlices, type RevealPlan } from './RevealPlan'
import { createMarkdownDocument } from './DocumentStore'
import { MarkdownController, type UpdateMeasurement, type MarkdownPerformanceEvent } from './MarkdownController'
export { createMarkdownDocument } from './DocumentStore'
import type { MarkdownBlock, MarkdownNode, MarkdownSnapshot } from './specs/MarkdownEngine.nitro'

declare const performance: { now(): number }

export type MarkdownStyles = Record<string, TextStyle & ViewStyle & ImageStyle>
export interface RenderContext {
  node: MarkdownNode
  /** Persistent block identity/revision and reveal metadata for animation adapters. */
  block?: MarkdownBlock
  children: ReactNode[]
  styles: MarkdownStyles
}
export type RenderRule = (context: RenderContext) => ReactNode
export type RenderRules = Record<string, RenderRule>
const defaults = StyleSheet.create({
  ...syntaxStyles,
  body: { gap: 8 }, paragraph: { fontSize: 16 }, strong: { fontWeight: 'bold' },
  em: { fontStyle: 'italic' }, s: { textDecorationLine: 'line-through' },
  code_inline: { fontFamily: 'monospace' }, fence: { fontFamily: 'monospace' },
  link: { color: '#2674d9' }, blockquote: { borderLeftWidth: 3, paddingLeft: 10 },
  heading1: { fontSize: 30, fontWeight: 'bold' }, heading2: { fontSize: 26, fontWeight: 'bold' },
  heading3: { fontSize: 22, fontWeight: 'bold' }, heading4: { fontSize: 20, fontWeight: 'bold' },
  heading5: { fontSize: 18, fontWeight: 'bold' }, heading6: { fontSize: 16, fontWeight: 'bold' },
  list_item: { flexDirection: 'row', alignItems: 'flex-start' },
  bullet_list_icon: { minWidth: 24, marginRight: 6 },
  ordered_list_icon: { minWidth: 24, marginRight: 6 },
  bullet_list_content: { flex: 1, minWidth: 0 },
  ordered_list_content: { flex: 1, minWidth: 0 },
  hr: { height: 1, backgroundColor: '#888' },
  table: { borderWidth: 1, borderColor: '#ccc' },
  tr: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  th: { flex: 1, minWidth: 0, padding: 8, fontWeight: 'bold' },
  td: { flex: 1, minWidth: 0, padding: 8 },
}) as MarkdownStyles
const blockFadeTypes = new Set(['fence', 'table', 'latex_inline', 'latex_block', 'image', 'code_inline'])
const blockTypes = new Set(['paragraph', 'bullet_list', 'ordered_list', 'blockquote', 'fence', 'table', 'hr', 'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6'])
const textTypes = new Set(['paragraph', 'strong', 'em', 's', 'code_inline', 'fence',
  ...Object.keys(syntaxStyles), 'double_quote', 'latex_inline', 'latex_block', 'th', 'td', 'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6'])

export interface MarkdownViewProps {
  typographer?: boolean
  snapshot: MarkdownSnapshot
  rules?: RenderRules
  styles?: MarkdownStyles
  /** Fade newly streamed content. Static text does not animate. */
  animate?: MarkdownAnimation
  /** Text direction and logical layout direction for list markers/tables. */
  direction?: 'auto' | 'ltr' | 'rtl'
}
const emptyRules: RenderRules = {}
const emptyStyles: MarkdownStyles = {}
const BlockView = memo(function BlockView({ block, rules, styles: resolved, animation, typographer }: { typographer: boolean; block: MarkdownBlock; rules: RenderRules; styles: MarkdownStyles; animation: ResolvedAnimation | null }) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string, MarkdownNode[]>()
    for (const node of block.nodes) {
      const siblings = map.get(node.parentId) ?? []
      siblings.push(node); map.set(node.parentId, siblings)
    }
    return map
  }, [block])
  const reveal = useRef<RevealPlan | undefined>(undefined)
  const animate = !!animation && animation.fadeDuration > 0
  const entered = useRef({ startedAt: animate && block.revealLength > 0 ? performance.now() : 0, duration: animation?.fadeDuration ?? 0 })
  const unsupported = block.nodes.some(node => blockFadeTypes.has(node.type))
  const plan = useMemo(() => {
    const text = block.nodes.filter(node => node.type === 'text').map(node => node.content).join('')
    const next = planReveal(reveal.current, text, block.revealLength, performance.now(), animate && !unsupported, animation?.fadeDuration, animation?.batchDelay)
    reveal.current = next
    return next
  }, [block, animate, unsupported, animation])
  const offsets = useMemo(() => {
    const result = new Map<string, number>(); let offset = 0
    if (!plan.batches.length) return result
    for (const node of block.nodes) if (node.type === 'text') { result.set(node.id, offset); offset += node.content.length }
    return result
  }, [block, plan])
  const hasTextStyle = resolved.text && Object.keys(resolved.text).length > 0
  function render(node: MarkdownNode, inText = false, inheritedColor = typeof resolved.body?.color === 'string' ? resolved.body.color : '#000000', literal = false): ReactNode {
    literal ||= ['fence', 'code_inline', 'latex_inline', 'latex_block', 'link'].includes(node.type)
    const ownColor = resolved[node.type]?.color
    const color = typeof ownColor === 'string' ? ownColor : inheritedColor
    // Unknown/custom parents conservatively receive Text-wrapped leaves.
    const textParent = !rules[node.type] && (textTypes.has(node.type) || node.type === 'link')
    const children = (childrenByParent.get(node.id) ?? []).map(child => render(child, textParent, color, literal))
    const custom = rules[node.type]
    if (custom) return <React.Fragment key={node.id}>{custom({ node, block, children, styles: resolved })}</React.Fragment>
    // Tight-list text can be a direct child of a View (no paragraph node).
    if (node.type === 'text') {
      const displayText = typographer && !literal ? typographicText(node.content) : node.content
      const slices = displayText === node.content && animate && !unsupported && plan.batches.length ? revealSlices(plan, node.content, offsets.get(node.id) ?? 0) : []
      const content = slices.length ? slices.map(slice => slice.batch
        ? <RevealText key={`${slice.batch.id}:${slice.offset}`} startedAt={slice.batch.startedAt} duration={slice.batch.duration} color={color}>{slice.text}</RevealText>
        : slice.text) : displayText
      if (inText && !hasTextStyle) return content
      return <Text key={node.id} style={resolved.text}>{content}</Text>
    }
    if (node.type === 'link') {
      const safe = /^(https?:|mailto:)/i.test(node.destination)
      return <Text key={node.id} style={resolved.link} onPress={safe ? () => { void Linking.openURL(node.destination).catch(() => {}) } : undefined}>{children}</Text>
    }
    if (node.type === 'image') return <Image key={node.id} source={{ uri: node.destination }} style={resolved.image ?? { width: 160, height: 100 }} />
    if (node.type === 'list_item') {
      const ordered = /^\d/.test(node.marker)
      const kind = ordered ? 'ordered_list' : 'bullet_list'
      // Tight lists omit paragraph nodes. Keep inline siblings on one text line,
      // while nested lists and other block children remain separate containers.
      const content: ReactNode[] = []
      let run: ReactNode[] = []
      const flush = () => {
        if (run.length) { content.push(<Text key={`inline-${content.length}`} style={resolved.paragraph}>{run}</Text>); run = [] }
      }
      ;(childrenByParent.get(node.id) ?? []).forEach((child, index) => {
        if (blockTypes.has(child.type)) { flush(); content.push(children[index]) }
        else run.push(children[index])
      })
      flush()
      return <View key={node.id} style={resolved.list_item}>
        <Text style={[resolved.paragraph, resolved[`${kind}_icon`]]}>{node.marker}</Text>
        <View style={resolved[`${kind}_content`]}>{content}</View>
      </View>
    }
    if (node.type === 'paragraph' && (childrenByParent.get(node.id) ?? []).some(child => child.type === 'latex_block')) {
      const content: ReactNode[] = []
      let inline: ReactNode[] = []
      const flush = () => {
        if (inline.length) { content.push(<Text key={`inline-${content.length}`} style={resolved.paragraph}>{inline}</Text>); inline = [] }
      }
      ;(childrenByParent.get(node.id) ?? []).forEach((child, index) => {
        if (child.type === 'latex_block') { flush(); content.push(children[index]) }
        else inline.push(children[index])
      })
      flush()
      return <View key={node.id}>{content}</View>
    }
    if (textTypes.has(node.type)) return <Text key={node.id} style={resolved[node.type]}>{children}</Text>
    return <View key={node.id} style={resolved[node.type]}>{children}</View>
  }
  const content = <>{(childrenByParent.get('') ?? []).map(node => render(node))}</>
  return unsupported && animate && entered.current.startedAt > 0 ? <RevealBlock startedAt={entered.current.startedAt} duration={entered.current.duration}>{content}</RevealBlock> : content
})
export function MarkdownView({ snapshot, rules = emptyRules, styles = emptyStyles, animate = true, direction = 'auto', typographer = false }: MarkdownViewProps) {
  const batchDelay = typeof animate === 'object' ? animate.batchDelay : undefined
  const fadeDuration = typeof animate === 'object' ? animate.fadeDuration : undefined
  const enabled = animate !== false
  const animation = useMemo(() => resolveAnimation(enabled ? { batchDelay, fadeDuration } : false), [enabled, batchDelay, fadeDuration])
  const resolved = useMemo(() => {
    const merged = { ...defaults, ...styles }
    const mathFontSize = merged.paragraph?.fontSize ?? merged.body?.fontSize ?? 16
    merged.latex_inline = { fontSize: mathFontSize, ...merged.latex_inline }
    merged.latex_block = { fontSize: mathFontSize, ...merged.latex_block }
    const layoutDirection = direction === 'auto' ? (I18nManager.isRTL ? 'rtl' : 'ltr') : direction
    merged.body = { ...merged.body, direction: layoutDirection }
    for (const type of textTypes) merged[type] = { textAlign: 'auto', writingDirection: direction, ...merged[type] }
    return merged
  }, [styles, direction])
  const children = snapshot.blocks.map(block =>
    <BlockView key={block.id} block={block} rules={rules} styles={resolved} animation={animation} typographer={typographer} />
  )
  if (rules.body) return <>{rules.body({ node: { id: 'body', parentId: '', type: 'body', content: '', destination: '', marker: '', sourceStart: -1, sourceEnd: -1 }, children, styles: resolved })}</>
  return <View style={resolved.body}>{children}</View>
}
type MarkdownInput = { children: string; source?: never } | { source: string; children?: never }
export type MarkdownProps = Omit<MarkdownViewProps, 'snapshot'> & MarkdownInput & {
  /** Per-element styles, e.g. { body: {...}, paragraph: {...} }. Alias of styles. */
  style?: MarkdownStyles
  /** Custom node renderers. Alias of rules. */
  renderRules?: RenderRules
  /** Repair incomplete syntax until false is supplied with the final text. */
  streaming?: boolean
  /** Log the displayed tree after each snapshot change. Off by default. */
  debugTree?: boolean
  /** All completed operations, including results superseded before display. */
  onPerformance?: (event: MarkdownPerformanceEvent) => void
  onError?: (error: unknown) => void
  onUpdate?: (snapshot: MarkdownSnapshot, measurement: UpdateMeasurement) => void
}
export function Markdown({ source, children, style, styles, renderRules, rules, streaming = false, onError, onUpdate, onPerformance, debugTree = false, animate = true, direction = 'auto', typographer = false }: MarkdownProps) {
  const text = source ?? children ?? ''
  const [snapshot, setSnapshot] = useState<MarkdownSnapshot>()
  const handlers = useRef({ onError, onUpdate, onPerformance })
  handlers.current = { onError, onUpdate, onPerformance }
  const [controller] = useState(() => new MarkdownController(
    createMarkdownDocument(),
    (value, timing) => { setSnapshot(value); handlers.current.onUpdate?.(value, timing) },
    error => { handlers.current.onError?.(error) },
  ))
  controller.observe(onPerformance ? event => handlers.current.onPerformance?.(event) : undefined)
  useEffect(() => {
    controller.update(text, streaming)
    return () => controller.cancel()
  }, [controller, text, streaming])
  useEffect(() => {
    if (!debugTree || !snapshot) return
    const tree = snapshot.blocks.map(block => `Block ${block.id} (revision ${block.revision})\n` +
      block.nodes.map(node => `${'  '.repeat(node.id.split('/').length - 1)}${node.type}${node.content ? ` ${JSON.stringify(node.content)}` : ''}`).join('\n')).join('\n')
    console.log(`Markdown tree (revision ${snapshot.revision})\n${tree}`)
  }, [snapshot, debugTree])
  return snapshot ? <MarkdownView snapshot={snapshot} styles={style ?? styles} rules={renderRules ?? rules} animate={animate} direction={direction} typographer={typographer} /> : null
}
