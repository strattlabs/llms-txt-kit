import { parseWithDiagnostics } from './parse.js';
import type { Diagnostic, LlmsDocument, ValidationResult } from './types.js';

/** Options controlling validation strictness. */
export interface ValidateOptions {
  /**
   * When true, relative link URLs are reported (LT011). `llms.txt` is often
   * consumed detached from its origin, so absolute URLs are recommended.
   * Defaults to true.
   */
  preferAbsoluteUrls?: boolean;
}

const DEFAULTS: Required<ValidateOptions> = {
  preferAbsoluteUrls: true,
};

/**
 * Validate an `llms.txt` source string against the spec.
 *
 * Combines structural diagnostics from the parser with semantic checks
 * (empty sections, duplicate URLs, missing summary, …). The result is
 * `valid` when no `error`-severity diagnostics were produced; warnings do
 * not fail validation.
 */
export function validate(
  source: string,
  options: ValidateOptions = {},
): ValidationResult {
  const opts = { ...DEFAULTS, ...options };
  const { document, diagnostics: structural } = parseWithDiagnostics(source);
  const semantic = semanticDiagnostics(document, opts);
  const diagnostics = sortByLine([...structural, ...semantic]);
  return {
    valid: !diagnostics.some((d) => d.severity === 'error'),
    diagnostics,
  };
}

/**
 * Run semantic-only checks against an already-parsed document. Useful when a
 * document is constructed in memory (e.g. by the generator) rather than parsed
 * from text. Line numbers are unavailable in this mode.
 */
export function validateDocument(
  document: LlmsDocument,
  options: ValidateOptions = {},
): ValidationResult {
  const opts = { ...DEFAULTS, ...options };
  const diagnostics = semanticDiagnostics(document, opts);
  if (document.title.trim() === '') {
    diagnostics.unshift({
      rule: 'LT001',
      severity: 'error',
      message: 'Missing required H1 title.',
    });
  }
  return {
    valid: !diagnostics.some((d) => d.severity === 'error'),
    diagnostics,
  };
}

function semanticDiagnostics(
  document: LlmsDocument,
  opts: Required<ValidateOptions>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (document.summary === undefined || document.summary.trim() === '') {
    diagnostics.push({
      rule: 'LT009',
      severity: 'warning',
      message:
        'No summary blockquote. A one-line "> summary" directly under the title is recommended.',
    });
  }

  if (document.sections.length === 0) {
    diagnostics.push({
      rule: 'LT010',
      severity: 'warning',
      message: 'No "## sections" found; the index has no links for consumers to follow.',
    });
  }

  const seenUrls = new Map<string, number>();
  for (const section of document.sections) {
    if (section.links.length === 0) {
      diagnostics.push({
        rule: 'LT003',
        severity: 'warning',
        message: `Section "${section.title}" has no links.`,
      });
    }
    for (const link of section.links) {
      const url = link.url.trim();
      if (url === '') continue;
      seenUrls.set(url, (seenUrls.get(url) ?? 0) + 1);
      if (opts.preferAbsoluteUrls && isRelativeUrl(url)) {
        diagnostics.push({
          rule: 'LT011',
          severity: 'warning',
          message: `Relative URL "${url}"; absolute URLs are recommended so the file is portable.`,
        });
      }
    }
  }

  for (const [url, count] of seenUrls) {
    if (count > 1) {
      diagnostics.push({
        rule: 'LT006',
        severity: 'warning',
        message: `Duplicate URL "${url}" appears ${count} times.`,
      });
    }
  }

  return diagnostics;
}

function isRelativeUrl(url: string): boolean {
  // Treat protocol-relative (`//host`) and absolute (`scheme://`) as absolute;
  // everything else (including root-relative `/path`) is relative.
  return !/^([a-z][a-z0-9+.-]*:)?\/\//i.test(url);
}

function sortByLine(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    const la = a.line ?? Number.MAX_SAFE_INTEGER;
    const lb = b.line ?? Number.MAX_SAFE_INTEGER;
    return la - lb;
  });
}
