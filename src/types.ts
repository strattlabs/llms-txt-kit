/**
 * Domain types for the `llms.txt` format.
 *
 * The format is defined at https://llmstxt.org. In short, an `llms.txt` file is
 * Markdown with a strict, predictable shape:
 *
 * ```markdown
 * # Title                         (required: exactly one H1, the project name)
 *
 * > Short summary                 (optional: a single blockquote)
 *
 * Free-form details...            (optional: zero or more paragraphs, no headings)
 *
 * ## Section name                 (zero or more H2 sections)
 * - [Link title](https://...): optional notes
 *
 * ## Optional                     (a section literally named "Optional" may be
 * - [Less important](https://...)  skipped by a consumer needing a shorter context)
 * ```
 *
 * These types model that shape as a small, lossless AST.
 */

/** A single link entry within a section: `- [title](url): notes`. */
export interface LlmsLink {
  /** The human-readable link text (the `[...]` part). */
  title: string;
  /** The link target (the `(...)` part). May be absolute or relative. */
  url: string;
  /** Optional trailing notes after `: ` on the same line. */
  notes?: string;
}

/** An H2 section grouping a list of links. */
export interface LlmsSection {
  /** The section heading text (the `## ...` part). */
  title: string;
  /** Links declared under this heading, in document order. */
  links: LlmsLink[];
  /**
   * True when the section is literally named "Optional" (case-insensitive).
   * Consumers may skip these links when a shorter context is needed.
   */
  optional: boolean;
}

/** A parsed `llms.txt` document. */
export interface LlmsDocument {
  /** The H1 title (project / site name). Required by the spec. */
  title: string;
  /** The summary blockquote, if present, with the leading `>` stripped. */
  summary?: string;
  /** Free-form Markdown between the summary and the first section, trimmed. */
  details?: string;
  /** H2 sections in document order. */
  sections: LlmsSection[];
}

/** Severity of a validation diagnostic. */
export type Severity = 'error' | 'warning';

/** A single validation finding. */
export interface Diagnostic {
  /** Stable rule identifier, e.g. `LT001`. */
  rule: string;
  severity: Severity;
  message: string;
  /** 1-based source line number, when the finding maps to a specific line. */
  line?: number;
}

/** The outcome of validating a document. */
export interface ValidationResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}
