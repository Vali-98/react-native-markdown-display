# Vendored tree-sitter sources

Pinned official release sources and archive SHA-256 values are recorded in
`versions.json`. Each directory retains its upstream MIT license.

Only the runtime and explicitly selected grammars are compiled. With highlighting
disabled, none of these C sources are built. TypeScript and TSX are separate
selections because their generated parsers are large.

The library uses the C parsing/query APIs with its own small, predicate-free
highlight queries in `cpp/HighlightQueries.hpp`. It does not require Node/WASM or
the Rust highlight library at runtime. Queries intentionally cover common lexical
categories; embedded-language injections and semantic analysis are not included.
