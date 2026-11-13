# Example app

Run these commands from the repository root:

```sh
npm install
npm run example:start
npm run example:android
```

For iOS, install CocoaPods and run `npm run example:ios` from the package directory. The launch script runs `pod install` automatically using your installed CocoaPods CLI; it does not use system Ruby’s Bundler. `npm run example:pods` can also install pods separately.

**Preview** switches between basic and custom rendering. **Compare** shows the original and new renderer side by side, with isolated modes under Benchmark options. Bottom controls set the stream speed; Fade settings controls grouping and duration. Diagnostics are collapsed by default, and previews follow streaming content automatically.

**Editor** (Android) demonstrates native inline styling, gray delimiters, and custom math/code/table previews. Tap a preview to edit its source; Preview blocks dismisses the keyboard and restores previews.

In Editor, **Styled previews / Raw text** switches the editing mode. **Typographer** enables display-only symbol and punctuation substitutions. Quote and link examples are included in the sample.

Editor also has **Basic** and **Custom rules** modes. Basic uses the default renderer (TeX source at body text size); Custom rules uses the reference styles and native RaTeX formulas.

**Editor → Input API** tests a Reanimated composer with TextInput-style props, `Keyboard.dismiss()`, a keyboard-hide blur hook, selection events and all three submission behaviors.

**Code** demonstrates tree-sitter highlighting, streaming, custom/default themes, unsupported-language fallback, and editable code. Its selected languages are configured in this app’s `package.json`.

The Editor and Code tabs support iOS and Android. On iOS, open `ios/ValiMarkdownExample.xcworkspace` after installing pods. The shared example scheme includes native editor tests. Run them in Xcode with Product → Test, or:

```sh
xcodebuild -workspace ios/ValiMarkdownExample.xcworkspace \
  -scheme ValiMarkdownExample \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' test
```

The native tests exercise source offsets, block folding, clipboard, typing, undo, composition, submission, and length limits. `npm run test:ios:projection` from the package directory runs the source-mapping tests without a simulator.

The example applies a CLI compatibility patch for Xcode 27, which uses Device Hub instead of `Simulator.app`. On older Xcode versions it continues to open Simulator.
