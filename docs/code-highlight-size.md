# Code highlighting size

Measured on Android arm64-v8a using the same release build and NDK 27.1.12297006. Sizes below cover only `libValiMarkdown.so`, stripped with `llvm-strip --strip-unneeded`. Gzip level 9 estimates compression; it is not an APK or store download measurement. iOS and other ABIs were not measured.

| Configuration | Stripped library | Gzip estimate |
| --- | ---: | ---: |
| Highlighting disabled | 1.51 MiB | 0.36 MiB |
| Previous four: JavaScript, TypeScript, Python, JSON | 3.97 MiB | 0.71 MiB |
| Requested fifteen | 13.33 MiB | 1.72 MiB |

All fifteen add 9.36 MiB stripped and 1.00 MiB gzip compared with the previous four.

Enabled: json, html, css, markdown, yaml, go, java, javascript, python, c, rust, bash, typescript, tsx, cpp. Swift, PHP, Ruby, and C# are excluded. Markdown includes both its block and inline grammar.

Largest grammar contributions before final linking (object code/data, not additive APK estimates):

- cpp: 3.28 MiB
- tsx: 1.38 MiB
- typescript: 1.35 MiB
- bash: 1.30 MiB
- rust: 1.06 MiB

Exact byte counts, configuration lists, and per-object measurements are in [code-highlight-size.json](code-highlight-size.json). Build selection is controlled by the consuming app’s `vali-markdown.codeHighlightLanguages`; omitted grammars are excluded from compilation.
