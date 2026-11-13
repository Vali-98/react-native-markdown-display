# @vali98/react-native-markdown-display

Markdown rendering for React Native with custom styles, render rules, and streaming text.

## Install

```sh
npm install @vali98/react-native-markdown-display react-native-nitro-modules react-native-reanimated react-native-worklets
```

Use React Native 0.86+ with the New Architecture. Add `react-native-worklets/plugin` last in your app's Babel plugins, install iOS pods, and rebuild the app.

## Use

```tsx
import Markdown from '@vali98/react-native-markdown-display'

<Markdown>{'# Hello\n\nSome **Markdown**.'}</Markdown>
```

Pass accumulated response text for streaming. Set `streaming` to false when it finishes; the component manages parsing and rendering updates.

```tsx
<Markdown
  streaming={isGenerating}
  style={{ paragraph: { fontSize: 16 }, strong: { color: 'purple' } }}
  animate={{ batchDelay: 40, fadeDuration: 220 }}
>
  {responseText}
</Markdown>
```

Animation timings are milliseconds. `batchDelay` groups fast arrivals without delaying display; it is capped at `fadeDuration`. Each batch keeps its original fade start and duration. `animate={true}` uses the defaults above; `false` disables fades; a zero fade duration displays text immediately. System reduced-motion settings are respected.

## Custom rendering

```tsx
import { Text } from 'react-native'
import Markdown, { type RenderRules } from '@vali98/react-native-markdown-display'

const rules: RenderRules = {
  strong: ({ children, styles }) => <Text style={styles.strong}>{children}</Text>,
}

<Markdown renderRules={rules}>{text}</Markdown>
```

Use `direction="rtl"` for RTL text and list/table layout. Per-element text styles can override alignment and writing direction. Custom render rules should apply the provided styles. RTL text uses native bidirectional layout; full RTL behavior has not been validated on both platforms.

Set `debugTree` to log the displayed tree. `onError` receives parsing errors; `onUpdate` receives displayed snapshots; optional `onPerformance` reports completed and superseded operations.

## Input (Android)

```tsx
import { useRef, useState } from 'react'
import { MarkdownInput, type MarkdownInputRef } from '@vali98/react-native-markdown-display'

const [value, setValue] = useState('Some **bold** text')
const input = useRef<MarkdownInputRef>(null)

<MarkdownInput
  ref={input}
  value={value}
  onChangeText={setValue}
  style={{ flex: 1 }}
  markdownStyle={styles}
  renderRules={rules}
  delimiterColor="#92979f"
  previews={true}
  typographer={false}
/>
```

The experimental Android editor keeps Markdown source in a native input and styles inline text while keeping delimiters visible. Top-level math blocks, fenced code and tables use the existing render rules for previews; placing the cursor inside reveals their source. Preview taps activate editing. `markdownStyle` styles previews; `textColor`, `fontSize` and `delimiterColor` style editable text. The ref exposes `focus()`, `blur()` and `activate(sourceOffset)`, with UTF-16 offsets.

Set `previews={false}` for unstyled raw-source editing. `typographer` is off by default and enables display-only symbols and punctuation replacements such as `(c)` → ©, `...` → …, `--` → – and `---` → —. It is also available on `<Markdown>`. The editor reveals original tokens under the cursor and never changes your controlled value; raw mode disables these substitutions. Code, math and link URLs remain literal. Inline quotes are colored; link labels are colored and underlined, with their Markdown syntax muted. Links remain editable rather than opening on tap.

Custom render rules apply to inactive block previews. Inline editing uses native spans; arbitrary React inline components are not supported inside editable text. iOS input is not implemented yet.

## Example

```sh
npm install
npm run example:start
npm run example:android
# Or: npm run example:pods && npm run example:ios
```

## Credits

Based on [react-native-markdown-display](https://github.com/iamacup/react-native-markdown-display), by Mient-jan Stelling, Tom Pickard, and contributors. Parsing uses [MD4C](https://github.com/mity/md4c). MIT licensed; see [LICENSE](LICENSE).
