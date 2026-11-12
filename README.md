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

## Example

```sh
npm install
npm run example:start
npm run example:android
# Or: npm run example:pods && npm run example:ios
```

## Credits

Based on [react-native-markdown-display](https://github.com/iamacup/react-native-markdown-display), by Mient-jan Stelling, Tom Pickard, and contributors. Parsing uses [MD4C](https://github.com/mity/md4c). MIT licensed; see [LICENSE](LICENSE).
