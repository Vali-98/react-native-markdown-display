# Example app

Run these commands from the repository root:

```sh
npm install
npm run example:start
npm run example:android
```

For iOS, run `npm run example:pods` followed by `npm run example:ios`.

**Preview** switches between basic and custom rendering. **Compare** shows the original and new renderer side by side, with isolated modes under Benchmark options. Bottom controls set the stream speed; Fade settings controls grouping and duration. Diagnostics are collapsed by default, and previews follow streaming content automatically.

**Editor** (Android) demonstrates native inline styling, gray delimiters, and custom math/code/table previews. Tap a preview to edit its source; Preview blocks dismisses the keyboard and restores previews.

In Editor, **Styled previews / Raw text** switches the editing mode. **Typographer** enables display-only symbol and punctuation substitutions. Quote and link examples are included in the sample.

Editor also has **Basic** and **Custom rules** modes. Basic uses the default renderer (TeX source at body text size); Custom rules uses the reference styles and native RaTeX formulas.
