import { describe, expect, it } from 'vitest';
import { parse, parseWithDiagnostics } from '../src/parse.js';

describe('parse', () => {
  it('parses title, summary, details and sections', () => {
    const src = [
      '# Example Project',
      '',
      '> A short summary of the project.',
      '',
      'Some free-form details about how to use it.',
      '',
      '## Docs',
      '- [Getting started](https://example.com/start): begin here',
      '- [API](https://example.com/api)',
      '',
      '## Optional',
      '- [Changelog](https://example.com/changelog)',
    ].join('\n');

    const doc = parse(src);

    expect(doc.title).toBe('Example Project');
    expect(doc.summary).toBe('A short summary of the project.');
    expect(doc.details).toBe('Some free-form details about how to use it.');
    expect(doc.sections).toHaveLength(2);

    const [docs, optional] = doc.sections;
    expect(docs?.title).toBe('Docs');
    expect(docs?.links).toEqual([
      { title: 'Getting started', url: 'https://example.com/start', notes: 'begin here' },
      { title: 'API', url: 'https://example.com/api' },
    ]);
    expect(optional?.optional).toBe(true);
  });

  it('flags a missing H1 title', () => {
    const { document, diagnostics } = parseWithDiagnostics(
      '## Docs\n- [x](https://e.com)',
    );
    expect(document.title).toBe('');
    expect(diagnostics.map((d) => d.rule)).toContain('LT001');
  });

  it('flags a malformed list item', () => {
    const { diagnostics } = parseWithDiagnostics(
      ['# T', '', '## S', '- not a link'].join('\n'),
    );
    const malformed = diagnostics.find((d) => d.rule === 'LT004');
    expect(malformed?.severity).toBe('error');
    expect(malformed?.line).toBe(4);
  });

  it('flags a second H1 as LT002', () => {
    const { diagnostics } = parseWithDiagnostics(['# One', '', '# Two'].join('\n'));
    expect(diagnostics.find((d) => d.rule === 'LT002')?.line).toBe(3);
  });

  it('flags content before the title as LT007', () => {
    const { diagnostics } = parseWithDiagnostics(['intro line', '# Title'].join('\n'));
    expect(diagnostics.find((d) => d.rule === 'LT007')?.line).toBe(1);
  });

  it('flags headings deeper than H2', () => {
    const { diagnostics } = parseWithDiagnostics(['# T', '### Too deep'].join('\n'));
    expect(diagnostics.some((d) => d.rule === 'LT008')).toBe(true);
  });

  it('handles CRLF line endings', () => {
    const doc = parse('# T\r\n\r\n## S\r\n- [a](https://e.com)\r\n');
    expect(doc.sections[0]?.links[0]?.url).toBe('https://e.com');
  });
});
