import React, { useRef, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import Markdown, { MarkdownInput } from '@vali98/react-native-markdown-display'
import { Action, BottomControls, PreviewPane, ui } from './TestUI'
import { StreamDelayControl } from './StreamDelayControl'
import { useStreamSample } from './useStreamSample'
import { markdownRules } from './custom/renderRules'
import { useMarkdownStyles } from './custom/styles'

const sample = '# Native code highlighting\n\nJavaScript (`js` alias):\n\n```js\n// Highlighting also works while streaming incomplete code.\nconst greeting = "Hello 😀";\nfunction greet(name) {\n  return `${greeting}, ${name}`;\n}\ngreet("World");\n```\n\nTypeScript:\n\n```ts\ninterface User {\n  name: string;\n  age: number;\n}\nconst user: User = { name: "Ada", age: 36 };\n```\n\nPython (`py` alias):\n\n```py\n# Native tree-sitter parser\ndef greet(name):\n    message = "Hello, " + name\n    return message\n\nprint(greet("World"))\n```\n\nJSON:\n\n```json\n{\n  "enabled": true,\n  "languages": ["javascript", "typescript", "python", "json"],\n  "count": 4\n}\n```\n\nUncompiled languages stay plain:\n\n```ruby\nputs "No Ruby grammar bundled"\n```\n'
export function CodeHighlightDemo() {
  const delay = useRef(30)
  const { frame, show } = useStreamSample(sample, delay)
  const [editing, setEditing] = useState(false)
  const [source, setSource] = useState(sample)
  const [custom, setCustom] = useState(true)
  const styles = useMarkdownStyles()
  return <View style={ui.screen}>
    <View style={ui.header}>
      <Text style={ui.title}>Code highlighting</Text>
      <Text style={ui.caption}>Compiled grammars color previews and editable source. Other languages stay plain.</Text>
    </View>
    {editing ? <MarkdownInput multiline style={{ flex: 1, minHeight: 0, backgroundColor: '#fff' }}
      value={source} onChangeText={setSource} markdownStyle={custom ? styles : undefined} renderRules={custom ? markdownRules : undefined} /> :
      <View style={ui.panes}><PreviewPane title={custom ? 'Custom fence rule & theme' : 'Default rendering & theme'} streaming={frame.streaming} followKey={frame.run}>
        <Markdown streaming={frame.streaming} animate={false} style={custom ? styles : undefined} renderRules={custom ? markdownRules : undefined}>{frame.source}</Markdown>
      </PreviewPane></View>}
    <BottomControls>
      <View style={ui.row}>
        <Action title="Full text" disabled={editing} onPress={() => { void show(false) }} />
        <Action title="Stream" disabled={editing} primary onPress={() => { void show(true) }} />
        <Action title={editing ? 'Rendering' : 'Edit code'} disabled={frame.streaming || (Platform.OS !== 'android' && Platform.OS !== 'ios')} selected={editing} onPress={() => setEditing(!editing)} />
        <Action title={custom ? 'Custom theme' : 'Default theme'} selected={custom} onPress={() => setCustom(!custom)} />
      </View>
      {!editing && <StreamDelayControl delay={delay} />}
    </BottomControls>
  </View>
}
