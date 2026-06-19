import type { Diagnostic, LlmsDocument, LlmsLink, LlmsSection } from './types.js';

const HEADING_RE = /^(#{1,6})\s+(.*\S)\s*$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;
const LIST_ITEM_RE = /^[-*]\s+(.*)$/;
// `[title](url)` optionally followed by `: notes`.
const LINK_RE = /^\[([^\]]*)\]\(([^)]*)\)\s*(?::\s*(.*\S))?\s*$/;

interface Heading {
  level: number;
  text: string;
}

function matchHeading(line: string): Heading | null {
  const m = HEADING_RE.exec(line);
  if (!m) return null;
  return { level: m[1]!.length, text: m[2]! };
}

/**
 * Parse an `llms.txt` source string into a {@link LlmsDocument}, collecting
 * structural diagnostics as it goes.
 *
 * Parsing is intentionally lenient: it recovers from malformed input so callers
 * always get a best-effort document plus a precise list of problems. The
 * higher-level {@link import('./validate.js').validate} function layers semantic
 * checks (duplicate URLs, empty sections, …) on top of these structural ones.
 */
export function parseWithDiagnostics(source: string): {
  document: LlmsDocument;
  diagnostics: Diagnostic[];
} {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const diagnostics: Diagnostic[] = [];

  let title = '';
  let titleLine = -1;
  let summary: string | undefined;
  const detailLines: string[] = [];
  const sections: LlmsSection[] = [];
  let current: LlmsSection | undefined;

  const summaryParts: string[] = [];
  let sawNonBlankBeforeTitle = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.replace(/\s+$/, '');
    const lineNo = i + 1;
    const heading = matchHeading(line);

    // --- Headings -----------------------------------------------------------
    if (heading) {
      if (heading.level === 1) {
        if (titleLine === -1) {
          title = heading.text;
          titleLine = lineNo;
        } else {
          diagnostics.push({
            rule: 'LT002',
            severity: 'error',
            message: `Multiple H1 headings; "${heading.text}" is a second top-level title.`,
            line: lineNo,
          });
        }
        continue;
      }

      if (heading.level === 2) {
        current = {
          title: heading.text,
          links: [],
          optional: heading.text.trim().toLowerCase() === 'optional',
        };
        sections.push(current);
        continue;
      }

      // H3+ — llms.txt is meant to be a flat index.
      diagnostics.push({
        rule: 'LT008',
        severity: 'warning',
        message: `Heading deeper than H2 ("${'#'.repeat(heading.level)} ${heading.text}"); llms.txt should stay flat.`,
        line: lineNo,
      });
      continue;
    }

    // --- Before the title ---------------------------------------------------
    if (titleLine === -1) {
      if (line.trim() !== '') {
        sawNonBlankBeforeTitle = true;
        diagnostics.push({
          rule: 'LT007',
          severity: 'error',
          message: 'Content appears before the required H1 title.',
          line: lineNo,
        });
      }
      continue;
    }

    // --- Blockquote summary -------------------------------------------------
    const bq = BLOCKQUOTE_RE.exec(line);
    if (bq && current === undefined) {
      // Only the first blockquote block (directly under the title, before any
      // section and before any details paragraph) is treated as the summary.
      if (summary === undefined && detailLines.length === 0) {
        summaryParts.push(bq[1]!);
        summary = summaryParts.join(' ').trim();
        continue;
      }
    }

    // --- List items (links) -------------------------------------------------
    const li = LIST_ITEM_RE.exec(line);
    if (li) {
      const link = parseLink(li[1]!);
      if (!link) {
        diagnostics.push({
          rule: 'LT004',
          severity: 'error',
          message: `Malformed list item; expected "- [title](url): notes" but got "${line.trim()}".`,
          line: lineNo,
        });
        continue;
      }
      if (link.title.trim() === '' || link.url.trim() === '') {
        diagnostics.push({
          rule: 'LT005',
          severity: 'error',
          message: `Link is missing a ${link.title.trim() === '' ? 'title' : 'URL'}.`,
          line: lineNo,
        });
      }
      if (current === undefined) {
        diagnostics.push({
          rule: 'LT012',
          severity: 'warning',
          message: 'Link declared before any "## section" heading.',
          line: lineNo,
        });
        // Still keep free-floating links out of details; record under a
        // synthetic, spec-discouraged location by ignoring for the AST.
        continue;
      }
      current.links.push(link);
      continue;
    }

    // --- Free-form details --------------------------------------------------
    if (current === undefined && line.trim() !== '') {
      detailLines.push(line);
    }
  }

  if (titleLine === -1) {
    diagnostics.push({
      rule: 'LT001',
      severity: 'error',
      message: 'Missing required H1 title (the first line should be "# Project Name").',
      ...(sawNonBlankBeforeTitle ? { line: 1 } : {}),
    });
  }

  const document: LlmsDocument = {
    title,
    sections,
    ...(summary !== undefined && summary !== '' ? { summary } : {}),
    ...(detailLines.length > 0 ? { details: detailLines.join('\n').trim() } : {}),
  };

  return { document, diagnostics };
}

/** Parse an `llms.txt` source string into a {@link LlmsDocument}. */
export function parse(source: string): LlmsDocument {
  return parseWithDiagnostics(source).document;
}

function parseLink(body: string): LlmsLink | null {
  const m = LINK_RE.exec(body.trim());
  if (!m) return null;
  const notes = m[3]?.trim();
  return {
    title: m[1]!.trim(),
    url: m[2]!.trim(),
    ...(notes ? { notes } : {}),
  };
}
