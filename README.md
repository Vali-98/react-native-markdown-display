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

## Code highlighting

Select languages in your app's `package.json` (next to `android/` and `ios/`):

```json
{
  "vali-markdown": {
    "enableCodeHighlight": true,
    "codeHighlightLanguages": ["javascript", "typescript", "python", "json"]
  }
}
```

Rebuild Android; on iOS run `pod install` and rebuild. Highlighting is off by default. Only selected grammars compile; disabling it or selecting an empty list also excludes the tree-sitter runtime. Available languages are `json`, `html`, `css`, `markdown`, `yaml`, `go`, `java`, `javascript`, `python`, `c`, `rust`, `bash`, `typescript`, `tsx`, and `cpp`. The example enables all 15. Fence aliases include `js`/`jsx`, `ts`, and `py`. Unknown or uncompiled languages remain plain code.

Highlighting runs in C++ for rendering and native input, with cached trees for streaming and edits. Custom fence rules receive highlighted `children` and `node.language`. Change colors through Markdown styles, for example `syntax_keyword`, `syntax_string`, `syntax_comment`, `syntax_number`, `syntax_function`, `syntax_type`, `syntax_property`, `syntax_constant`, `syntax_tag`, `syntax_attribute`, and `syntax_embedded`. Themes do not require rebuilding. Code text is preserved exactly. Very large or expensive blocks fall back to plain code.

## Input (Android)

```tsx
import { useRef, useState } from 'react'
import { MarkdownInput, type MarkdownInputRef } from '@vali98/react-native-markdown-display'

const [value, setValue] = useState('Some **bold** text')
const input = useRef<MarkdownInputRef>(null)

<MarkdownInput
  ref={input}
  multiline
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

The experimental native editor keeps Markdown source in a native input and styles inline text while keeping delimiters visible. Top-level math blocks, fenced code and tables use the existing render rules for previews; placing the cursor inside reveals their source. Preview taps activate editing. `markdownStyle` styles Markdown previews and native inline formatting. Quote/link styles use `double_quote` and `link`; native spans support color, background color, font size/family/weight/style, and underline/strikethrough. Custom render rules apply to React block previews.

Use `textStyle` for the editable source and `viewStyle` for borders, background, and layout. TextInput-style `style` also works: text and padding fields configure the native source input, while view fields configure its container. Editable-source text styles never cascade into React previews. `delimiterColor` controls source delimiters.

The composer API supports controlled `value` or uncontrolled `defaultValue`, placeholder colors, focus/blur/press/change/selection/content-size events, selection, line count, keyboard type, capitalization, autocorrect, length limits and editable/read-only state. Events use the TextInput `event.nativeEvent` shape. As with TextInput, `multiline` defaults to false. `submitBehavior` accepts `newline`, `submit`, or `blurAndSubmit`; Shift+Enter inserts a newline in multiline submission modes.

The ref supports `focus()`, `blur()`, `isFocused()`, `clear()`, `setSelection(start, end)` and native measurement methods, plus `activate(sourceOffset)`. Offsets use UTF-16. Use `MarkdownInputRef` for your ref type. `Keyboard.dismiss()` and the keyboard-hide blur hook work with React Native's focus registry. `Animated.createAnimatedComponent(MarkdownInput)` supports layout and outer view animations; text/padding animation through native animated props is not implemented. This is a supported subset of TextInput, not its entire platform-specific API.

Set `previews={false}` for unstyled raw-source editing. `typographer` is off by default and enables display-only symbols and punctuation replacements such as `(c)` → ©, `...` → …, `--` → – and `---` → —. It is also available on `<Markdown>`. The editor reveals original tokens under the cursor and never changes your controlled value; raw mode disables these substitutions. Code, math and link URLs remain literal. Inline quotes are colored; link labels are colored and underlined, with their Markdown syntax muted. Links remain editable rather than opening on tap.

Custom render rules apply to inactive block previews. Inline editing uses native spans; arbitrary React inline components are not supported inside editable text. Input uses `UITextView` on iOS and `EditText` on Android. Both use the shared C++ analyzer. On iOS, collapsed blocks and typography use attachments; values, selection callbacks, clipboard text, and undo retain the original Markdown and UTF-16 source offsets. iOS uses a shared system tint for the cursor and selection.

## Example

```sh
npm install
npm run example:start
npm run example:android
# Or: npm run example:pods && npm run example:ios
```

## Credits

Based on [react-native-markdown-display](https://github.com/iamacup/react-native-markdown-display), by Mient-jan Stelling, Tom Pickard, and contributors. Parsing uses [MD4C](https://github.com/mity/md4c); code highlighting uses [tree-sitter](https://tree-sitter.github.io/tree-sitter/). Bundled dependencies retain their licenses in `vendor/`. MIT licensed; see [LICENSE](LICENSE).
