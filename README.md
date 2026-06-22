# llms-txt-kit

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) · [strattlabs.com](https://strattlabs.com)

Generate and validate spec-compliant [`llms.txt`](https://llmstxt.org) and
`llms-full.txt` files.

`llms.txt` is a simple, growing convention for making a site legible to LLMs and
AI agents: a single Markdown file at your site root that indexes your most
important pages, plus an optional `llms-full.txt` that inlines the full content.
This kit gives you a small, dependency-free CLI and library to **generate** those
files from your existing Markdown content and to **validate** files you already
have.

- **Zero runtime dependencies.** Pure TypeScript; nothing to audit downstream.
- **Generator** — crawl a content directory and emit `llms.txt` + `llms-full.txt`.
- **Validator/linter** — check an existing file against the spec with precise,
  rule-coded diagnostics.
- **Library API** — `parse`, `format`, `validate`, `generate` for programmatic use.

> **Status:** v0.1 — early but production-shaped. The API surface in
> [`src/index.ts`](src/index.ts) is the stable contract.

## Install

```bash
pnpm add -D @strattlabs/llms-txt-kit
# or: npm i -D @strattlabs/llms-txt-kit / yarn add -D @strattlabs/llms-txt-kit
```

Requires Node.js ≥ 18.18.

## CLI

### Generate

```bash
llms-txt generate \
  --content ./docs \
  --base-url https://example.com \
  --title "Example Docs" \
  --summary "Everything you need to integrate with Example." \
  --out .
```

Writes `llms.txt` and `llms-full.txt` to `--out` (default: current directory).
Use `--stdout` to print `llms.txt` instead of writing files.

Per-file metadata is read from optional YAML frontmatter; sensible fallbacks are
derived from the document body and file path when it is absent:

```markdown
---
title: Quickstart
description: Make your first API call in five minutes.
section: Guides
order: 1
draft: false
---

# Quickstart

...
```

| Frontmatter key | Effect                                 | Fallback                                           |
| --------------- | -------------------------------------- | -------------------------------------------------- |
| `title`         | Link text in the index                 | first `# H1`, else humanized filename              |
| `description`   | Trailing notes on the link             | first prose line (truncated)                       |
| `section`       | `## Section` the link is grouped under | top-level folder name, else `Docs`                 |
| `order`         | Sort order within a section            | alphabetical by title                              |
| `url`           | Override the derived link URL          | `base-url` + path (ext stripped, `index` → folder) |
| `draft`         | `true` excludes the file               | included                                           |

A section literally named `Optional` is emitted last, matching the spec's
special-case semantics (consumers may skip it when they need a shorter context).

### Validate

```bash
llms-txt validate ./llms.txt
llms-txt validate ./llms.txt --strict          # warnings fail too
llms-txt validate ./llms.txt --no-absolute-urls # don't warn on relative URLs
```

Exit code is `1` when there are errors (or warnings under `--strict`), else `0` —
suitable for CI.

## Library

```ts
import { generate, validate, parse, format } from '@strattlabs/llms-txt-kit';

const { llmsTxt, llmsFullTxt } = await generate({
  contentDir: './docs',
  baseUrl: 'https://example.com',
  title: 'Example Docs',
});

const result = validate(llmsTxt);
if (!result.valid) {
  for (const d of result.diagnostics) {
    console.error(`${d.rule} ${d.severity}: ${d.message}`);
  }
}

// Lossless AST round-trips: parse(format(doc)) deep-equals doc.
const doc = parse(llmsTxt);
const text = format(doc);
```

## Validation rules

| Rule  | Severity | Meaning                                             |
| ----- | -------- | --------------------------------------------------- |
| LT001 | error    | Missing required H1 title                           |
| LT002 | error    | More than one H1                                    |
| LT003 | warning  | Section has no links                                |
| LT004 | error    | Malformed list item (not `- [title](url)`)          |
| LT005 | error    | Link missing a title or URL                         |
| LT006 | warning  | Duplicate URL                                       |
| LT007 | error    | Content before the H1 title                         |
| LT008 | warning  | Heading deeper than H2 (index should be flat)       |
| LT009 | warning  | No summary blockquote                               |
| LT010 | warning  | No sections at all                                  |
| LT011 | warning  | Relative URL (absolute recommended for portability) |
| LT012 | warning  | Link declared before any section heading            |

Validation is **structural**: it checks that a file conforms to the `llms.txt`
format. It does not fetch URLs or judge content quality.

## Why MIT?

This kit operates entirely on a public standard and formats public content into
a public file format. We want the widest possible adoption — embedding it in
other tools, docs pipelines, and frameworks — with zero friction. MIT is the
lowest-friction, most-recognized permissive license for that goal. (Apache-2.0's
explicit patent grant adds little here: there is no novel, patentable method in a
text formatter, and the extra ceremony would only slow adoption.)

## Examples

See [`examples/`](examples/):

- [`examples/content/`](examples/content) — a small Markdown tree you can run the
  generator against.
- [`examples/llms-invalid.txt`](examples/llms-invalid.txt) — a deliberately broken
  file that trips most validation rules; try `llms-txt validate examples/llms-invalid.txt`.

## Development

```bash
pnpm install
pnpm test          # vitest
pnpm typecheck
pnpm lint
pnpm build         # emit dist/
```

## License

[MIT](LICENSE) © 2026 Stratt Labs

---

## Part of the Stratt Labs toolkit for the agentic web

Small, standards-friendly tools from [Stratt Labs](https://strattlabs.com):

- [agent-readiness-manifest](https://github.com/strattlabs/agent-readiness-manifest)
  — an open declaration spec for agent discovery.
- [schema-for-agents](https://github.com/strattlabs/schema-for-agents) — JSON-LD
  recipes for agent-legible commerce and content.
- [webmcp-starter](https://github.com/strattlabs/webmcp-starter) — a minimal
  WebMCP reference page.
