import type { LlmsDocument, LlmsLink } from './types.js';

/**
 * Serialize a {@link LlmsDocument} back into a spec-compliant `llms.txt` string.
 *
 * The output is deterministic and round-trips through {@link import('./parse.js').parse}:
 * `parse(format(doc))` yields an equivalent document.
 */
export function format(document: LlmsDocument): string {
  const blocks: string[] = [];

  blocks.push(`# ${document.title.trim()}`);

  if (document.summary && document.summary.trim() !== '') {
    blocks.push(`> ${document.summary.trim()}`);
  }

  if (document.details && document.details.trim() !== '') {
    blocks.push(document.details.trim());
  }

  for (const section of document.sections) {
    const lines = [`## ${section.title.trim()}`];
    for (const link of section.links) {
      lines.push(formatLink(link));
    }
    blocks.push(lines.join('\n'));
  }

  // Blocks are separated by a blank line; file ends with a single newline.
  return blocks.join('\n\n') + '\n';
}

function formatLink(link: LlmsLink): string {
  const base = `- [${link.title.trim()}](${link.url.trim()})`;
  return link.notes && link.notes.trim() !== '' ? `${base}: ${link.notes.trim()}` : base;
}
