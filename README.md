# @vali98/react-native-markdown-display

Markdown rendering and editing for React Native on iOS and Android.

## Features

- iOS and Android rendering with C++/MD4C and Nitro Modules; no WebView.
- GFM tables, task lists, strikethrough, nested quotes, and math syntax.
- Custom styles and render rules, streaming repair, and fade-in animations.
- Native editor with inline styling and cursor-aware block previews.
- Optional tree-sitter highlighting, typography substitutions, and RTL controls.

## Install

```sh
npm install @vali98/react-native-markdown-display react-native-nitro-modules react-native-reanimated react-native-worklets
```

Requires React Native 0.86+ and the New Architecture. Add `react-native-worklets/plugin` last in Babel’s plugins, install iOS pods, and rebuild.

## Markdown

```tsx
import Markdown from '@vali98/react-native-markdown-display'

<Markdown
  streaming={isGenerating}
  style={{ paragraph: { fontSize: 16 }, strong: { color: 'purple' } }}
  animate={{ batchDelay: 40, fadeDuration: 220 }}
>
  {responseText}
</Markdown>
```

Pass accumulated text while streaming; set `streaming={false}` when finished. Updates are managed automatically.

| Prop | Type / default | Purpose |
| --- | --- | --- |
| `children` or `source` | `string`, required | Markdown text; supply one. |
| `style` | `MarkdownStyles` | Styles keyed by node type, such as `paragraph`, `link`, and `heading1`. Alias: `styles`. |
| `renderRules` | `RenderRules` | Custom node renderers. Alias: `rules`. |
| `streaming` | `boolean`, `false` | Repair incomplete syntax while streaming. |
| `animate` | `boolean` or settings, `true` | Fade new content in; `false` disables animation. |
| `typographer` | `boolean`, `false` | Display substitutions such as `(c)` → © and `...` → …. |
| `direction` | `'auto'`, `'ltr'`, or `'rtl'` | Text and layout direction; defaults to `auto`. |
| `debugTree` | `boolean`, `false` | Log the displayed tree. |
| `onUpdate` | `(snapshot, measurement) => void` | Receive displayed document updates. |
| `onPerformance` | `(event) => void` | Receive timing and scheduling diagnostics. |
| `onError` | `(error) => void` | Receive parsing errors. |

Animation settings (milliseconds):

| Setting | Default | Purpose |
| --- | --- | --- |
| `batchDelay` | `40` | Group nearby arrivals without delaying text display; capped at `fadeDuration`. |
| `fadeDuration` | `220` | Fade lifetime; `0` reveals immediately. |

System reduced-motion settings are respected.

Render rules receive `{ node, children, styles, block }` (`block` is optional):

```tsx
const renderRules = {
  strong: ({ children, styles }) => <Text style={styles.strong}>{children}</Text>,
}
```

Import `Text` from React Native. For rendered math, supply a math rule using a library such as RaTeX.

## MarkdownInput

```tsx
import { MarkdownInput } from '@vali98/react-native-markdown-display'

<MarkdownInput
  multiline
  value={text}
  onChangeText={setText}
  viewStyle={{ flex: 1, borderWidth: 1, borderRadius: 8 }}
  textStyle={{ fontSize: 16 }}
  markdownStyle={markdownStyles}
  renderRules={renderRules}
/>
```

Experimental native editor: delimiters stay visible; tapping a code, table, or math preview reveals its source.

| Prop | Type / default | Purpose |
| --- | --- | --- |
| `value` / `defaultValue` | `string` | Controlled or initial Markdown source. |
| `onChangeText` | `(text: string) => void` | Receive source edits. |
| `textStyle` | `StyleProp<TextStyle>` | Editable-source styles only. |
| `viewStyle` | `StyleProp<ViewStyle>` | Container layout, borders, and background. |
| `style` | TextInput-style styles | Combined source text, padding, and container styles. |
| `markdownStyle` | `MarkdownStyles` | Preview styles and native inline formatting. |
| `renderRules` | `RenderRules` | Custom renderers for inactive block previews. |
| `previews` | `boolean`, `true` | Styled editing; `false` shows raw source. |
| `typographer` | `boolean`, `false` | Display-only substitutions; source stays unchanged. |
| `delimiterColor` | `ColorValue`, `#92979f` | Markdown delimiter color. |
| `textColor` / `fontSize` | Color / number | Source color and size aliases; default `#202124` / `16`. |
| `multiline` | `boolean`, `false` | Enable multiline editing. |
| `numberOfLines` | `number`, `1` | Grow from one line up to this many, then scroll. Explicit height overrides auto-sizing. |
| `submitBehavior` | `'newline'`, `'submit'`, or `'blurAndSubmit'` | Defaults to `newline` for multiline, otherwise `blurAndSubmit`. |

Supports a [TextInput prop subset](src/InputCompatibility.ts), including placeholders, selection, keyboard options, length limits, read-only state, accessibility, and events (`event.nativeEvent`).

`MarkdownInputRef`: `focus()`, `blur()`, `isFocused()`, `clear()`, `setSelection(start, end)`, `activate(offset)`, and measurement methods. Offsets use UTF-16. Supports `Keyboard.dismiss()` and Reanimated layout animations.

Inline formatting accepts custom styles; React render rules apply to block previews. Source styles stay separate. iOS shares one cursor/selection tint.

## Code highlighting

Configure your app’s `package.json`, then reinstall iOS pods and rebuild:

```json
{
  "vali-markdown": {
    "enableCodeHighlight": true,
    "codeHighlightLanguages": ["javascript", "typescript", "python", "json"]
  }
}
```

Highlighting is off by default. Only selected grammars compile. Available languages:

`json`, `html`, `css`, `markdown`, `yaml`, `go`, `java`, `javascript`, `python`, `c`, `rust`, `bash`, `typescript`, `tsx`, `cpp`.

Theme with [syntax styles](src/SyntaxHighlighting.ts), e.g. `syntax_keyword: { color: '#C678DD' }`. Unsupported languages remain plain code.

## MarkdownView

Lower-level renderer for snapshots from `createMarkdownDocument()`:

| Prop | Type / default | Purpose |
| --- | --- | --- |
| `snapshot` | `MarkdownSnapshot`, required | Document snapshot to render. |
| `styles` | `MarkdownStyles` | Node styles. |
| `rules` | `RenderRules` | Custom node renderers. |
| `animate` | `boolean` or settings, `true` | Same animation controls as `Markdown`. |
| `typographer` | `boolean`, `false` | Typography substitutions. |
| `direction` | `'auto'`, `'ltr'`, or `'rtl'` | Layout direction; defaults to `auto`. |

## Example

```sh
npm install
npm run example:start
npm run example:android
# or: npm run example:ios
```

## Credits

Based on [react-native-markdown-display](https://github.com/iamacup/react-native-markdown-display), by Mient-jan Stelling, Tom Pickard, and contributors. Uses [MD4C](https://github.com/mity/md4c) and [tree-sitter](https://tree-sitter.github.io/tree-sitter/). Dependency licenses are in `vendor/`. [MIT license](LICENSE).
