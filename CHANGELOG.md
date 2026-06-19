# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

### Added

- `generate` — crawl a Markdown content directory and emit spec-compliant
  `llms.txt` and `llms-full.txt`, with frontmatter-driven titles, descriptions,
  sections, ordering, URL overrides, and draft exclusion.
- `validate` — structural linter with twelve rule-coded diagnostics (LT001–LT012).
- `parse` / `format` — a lossless AST that round-trips through serialization.
- `llms-txt` CLI wrapping `generate` and `validate`, with CI-friendly exit codes.
- Zero runtime dependencies.
