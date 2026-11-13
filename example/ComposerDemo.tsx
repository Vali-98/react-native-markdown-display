import React, { useEffect, useRef, useState } from 'react'
import { Keyboard, Text, View, type TextInputProps } from 'react-native'
import Animated, { LinearTransition } from 'react-native-reanimated'
import { MarkdownInput, type MarkdownInputRef } from '@vali98/react-native-markdown-display'
import { Action, BottomControls, Disclosure, ui } from './TestUI'

const AnimatedMarkdownInput = Animated.createAnimatedComponent(MarkdownInput)
function useUnfocusInput(enabled: boolean) {
  const ref = useRef<MarkdownInputRef>(null)
  useEffect(() => {
    if (!enabled) return undefined
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      if (ref.current?.isFocused()) ref.current.blur()
    })
    return () => subscription.remove()
  }, [enabled])
  return ref
}
export function ComposerDemo({ onBack }: { onBack: () => void }) {
  const [value, setValue] = useState('A **Markdown** composer')
  const [behavior, setBehavior] = useState<NonNullable<TextInputProps['submitBehavior']>>('newline')
  const [editable, setEditable] = useState(true)
  const [unfocus, setUnfocus] = useState(true)
  const [narrow, setNarrow] = useState(false)
  const [focused, setFocused] = useState(false)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [submissions, setSubmissions] = useState(0)
  const [submitted, setSubmitted] = useState('')
  const [presses, setPresses] = useState(0)
  const input = useUnfocusInput(unfocus)
  return <View style={ui.screen}>
    <View style={ui.header}>
      <Text style={ui.title}>TextInput compatibility</Text>
      <Text testID="composer-status" style={ui.caption}>{focused ? 'Focused' : 'Blurred'} · presses {presses} · selection {selection.start}–{selection.end} · submissions {submissions}</Text>
      {!!submitted && <Text testID="composer-submitted" numberOfLines={2} style={ui.caption}>Submitted: {submitted}</Text>}
    </View>
    <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 8 }}>
      <AnimatedMarkdownInput ref={input} testID="composer-input" layout={LinearTransition.duration(180)}
        style={{ color: '#253344', backgroundColor: '#fff', flex: 1, borderWidth: 2, borderColor: editable ? '#7c6ee6' : '#c7c2ce', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, fontSize: 14, width: narrow ? '75%' : '100%' }}
        numberOfLines={8} multiline placeholder="Write a message…" placeholderTextColor="#7f788c"
        editable={editable} value={value} onChangeText={setValue}
        onPress={() => setPresses(previous => previous + 1)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onSelectionChange={event => setSelection(event.nativeEvent.selection)}
        submitBehavior={behavior} returnKeyType={behavior === 'newline' ? 'default' : 'send'}
        onSubmitEditing={event => { setSubmitted(event.nativeEvent.text); setSubmissions(previous => previous + 1) }} />
    </View>
    <BottomControls>
      <View style={ui.row}>
        {(['newline', 'submit', 'blurAndSubmit'] as const).map(mode => <Action key={mode} title={mode} selected={behavior === mode} onPress={() => setBehavior(mode)} />)}
      </View>
      <View style={ui.row}>
        <Action title="Focus" onPress={() => input.current?.focus()} />
        <Action title="Dismiss" onPress={() => Keyboard.dismiss()} />
        <Action title="Clear" onPress={() => { input.current?.clear(); setValue('') }} />
        <Action title="Back" onPress={onBack} />
      </View>
      <Disclosure title="More input controls">
        <View style={ui.row}>
          <Action title="Editable" selected={editable} onPress={() => setEditable(!editable)} />
          <Action title="Unfocus on hide" selected={unfocus} onPress={() => setUnfocus(!unfocus)} />
          <Action title="Animate width" selected={narrow} onPress={() => setNarrow(!narrow)} />
          <Action title="Select all" onPress={() => input.current?.setSelection(0, value.length)} />
        </View>
        <Text style={ui.caption}>Styled padding, placeholder color, eight-line sizing, ref methods, keyboard submission and Reanimated layout. Shift+Enter inserts a newline in multiline submission modes.</Text>
      </Disclosure>
    </BottomControls>
  </View>
}
