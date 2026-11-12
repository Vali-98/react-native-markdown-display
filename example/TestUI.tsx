import React, { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function Action({ title, onPress, selected = false, disabled = false, primary = false }: { title: string; onPress: () => void; selected?: boolean; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.button, (selected || primary) && ui.activeButton, disabled && { opacity: .4 }, pressed && { opacity: .75 }]}>
    <Text style={[ui.buttonText, (selected || primary) && { color: '#fff' }]}>{title}</Text>
  </Pressable>
}
export function Disclosure({ title, children, onToggle }: { title: string; children: ReactNode; onToggle?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false)
  return <View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => { const next = !open; setOpen(next); onToggle?.(next) }} style={ui.disclosure}>
      <Text style={ui.caption}>{open ? '▾' : '▸'} {title}</Text>
    </Pressable>
    {open && children}
  </View>
}
export function BottomControls({ children }: { children: ReactNode }) {
  // Normal flex layout reserves the entire footer + bottom inset. Nothing overlays
  // the previews, and the Android navigation bar / iOS home indicator stay clear.
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={ui.footer}><View style={ui.footerContent}>{children}</View></SafeAreaView>
}
export function PreviewPane({ title, streaming, followKey, children }: { title: string; streaming: boolean; followKey: number; children: ReactNode }) {
  const scroll = useRef<ScrollView>(null)
  const wasStreaming = useRef(false)
  const follow = useRef(false)
  const scheduled = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (wasStreaming.current && !streaming) scroll.current?.scrollToEnd({ animated: false })
    if (streaming) follow.current = true
    wasStreaming.current = streaming
  }, [streaming])
  useEffect(() => {
    if (!streaming) { follow.current = false; scroll.current?.scrollTo({ y: 0, animated: false }) }
    else { follow.current = true; scroll.current?.scrollToEnd({ animated: false }) }
    return () => { if (scheduled.current !== undefined) cancelAnimationFrame(scheduled.current) }
  }, [followKey])
  const changed = () => {
    // Keep following through the final native update / late math measurement.
    if (!follow.current || scheduled.current !== undefined) return
    scheduled.current = requestAnimationFrame(() => {
      scheduled.current = undefined
      scroll.current?.scrollToEnd({ animated: false })
    })
  }
  return <View style={ui.pane}>
    <View style={ui.paneHeader}><Text style={ui.paneTitle}>{title}</Text>{streaming && <Text style={ui.live}>LIVE</Text>}</View>
    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={ui.previewContent} onContentSizeChange={changed} onLayout={changed}>
      {children}
    </ScrollView>
  </View>
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2f7' },
  topbar: { backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#dfdce8' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  header: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 6 },
  title: { fontSize: 21, fontWeight: '700', color: '#252337' },
  caption: { color: '#777185', fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  button: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, backgroundColor: '#eeecf4', alignItems: 'center', justifyContent: 'center' },
  activeButton: { backgroundColor: '#6953b2' },
  buttonText: { fontSize: 13, fontWeight: '600', color: '#514466' },
  disclosure: { paddingVertical: 6 },
  footer: { backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#dfdce8' },
  footerContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, gap: 6 },
  panes: { flex: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingBottom: 10, minHeight: 0 },
  pane: { flex: 1, minWidth: 0, borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#dfdce8' },
  paneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eeecf4' },
  paneTitle: { fontSize: 13, fontWeight: '700', color: '#514466' }, live: { color: '#6953b2', fontSize: 9, fontWeight: '700' },
  previewContent: { padding: 10, paddingBottom: 22 },
  metrics: { paddingHorizontal: 14, paddingBottom: 8 },
  metricLabel: { color: '#777185', fontSize: 11 },
  metricValue: { color: '#252337', fontSize: 13, fontVariant: ['tabular-nums'], marginTop: 2 },
  details: { maxHeight: 210, padding: 10, backgroundColor: '#eeecf4', borderRadius: 8 },
})
