import React, { useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { MarkdownInput, type MarkdownInputRef } from '@vali98/react-native-markdown-display'
import { Action, BottomControls, ui } from './TestUI'
import { ComposerDemo } from './ComposerDemo'
import { markdownRules } from './custom/renderRules'
import { useMarkdownStyles } from './custom/styles'

const sample = '# Live Markdown\n\nEdit **bold**, *italic*, ~~strike~~ and `code`.\n\n$$\nx^2 + y^2 = z^2\n$$\n\n```ts\nconst message = "Hello"\n```\n\n| Name | Value |\n| --- | --- |\n| One | 1 |\n| Two | 2 |\n\n"Quoted text" and [link text](https://example.com).\n\n(c) (C) (r) (R) (tm) (TM) (p) (P) +-\n\ntest.. test... test..... test?..... test!....\n\n!!!!!! ???? ,,  -- ---\n\nTap a preview to edit its source.\n'
export function EditorDemo() {
  const [composer, setComposer] = useState(false)
  const [value, setValue] = useState(sample)
  const [variant, setVariant] = useState<'basic' | 'custom'>('custom')
  const [previews, setPreviews] = useState(true)
  const [typographer, setTypographer] = useState(false)
  const input = useRef<MarkdownInputRef>(null)
  const styles = useMarkdownStyles()
  if (composer) return <ComposerDemo onBack={() => setComposer(false)} />
  return <View style={ui.screen}>
    <View style={ui.header}><Text style={ui.title}>Markdown editor · Android</Text>
      <Text style={ui.caption}>{variant === 'custom' ? 'Custom styles and render rules · native RaTeX math previews.' : 'Basic styles · no render rules · math shown as TeX source.'}</Text></View>
    <MarkdownInput multiline ref={input} style={{ flex: 1, minHeight: 0, backgroundColor: '#fff' }}
      value={value} onChangeText={setValue} previews={previews} typographer={typographer} markdownStyle={variant === 'custom' ? styles : undefined} renderRules={variant === 'custom' ? markdownRules : undefined} placeholder="Write Markdown…" />
    <BottomControls><View style={ui.row}>
      <Action title="Keyboard" onPress={() => input.current?.focus()} />
      <Action title="Preview blocks" onPress={() => input.current?.blur()} />
      <Action title="Reset" onPress={() => { input.current?.blur(); setValue(sample) }} />
    </View><View style={ui.row}>
      <Action title={previews ? 'Styled previews' : 'Raw text'} selected={previews} onPress={() => setPreviews(!previews)} />
      <Action title="Typographer" selected={typographer} onPress={() => setTypographer(!typographer)} />
    </View><View style={ui.row}>
      <Action title="Input API" onPress={() => setComposer(true)} />
      <Action title="Basic" selected={variant === 'basic'} onPress={() => setVariant('basic')} />
      <Action title="Custom rules" selected={variant === 'custom'} onPress={() => setVariant('custom')} />
    </View></BottomControls>
  </View>
}
