import { describe, expect, it } from 'vitest';
import { format } from '../src/format.js';
import { parse } from '../src/parse.js';
import type { LlmsDocument } from '../src/types.js';

describe('format', () => {
  it('serializes a document to spec-compliant text', () => {
    const doc: LlmsDocument = {
      title: 'Example',
      summary: 'Summary line.',
      sections: [
        {
          title: 'Docs',
          optional: false,
          links: [
            { title: 'Start', url: 'https://e.com/start', notes: 'begin' },
            { title: 'API', url: 'https://e.com/api' },
          ],
        },
      ],
    };

    expect(format(doc)).toBe(
      [
        '# Example',
        '',
        '> Summary line.',
        '',
        '## Docs',
        '- [Start](https://e.com/start): begin',
        '- [API](https://e.com/api)',
        '',
      ].join('\n'),
    );
  });

  it('round-trips through parse', () => {
    const src = [
      '# Project',
      '',
      '> Summary.',
      '',
      'Details paragraph.',
      '',
      '## Guides',
      '- [One](https://e.com/1): first',
      '- [Two](https://e.com/2)',
      '',
    ].join('\n');

    expect(format(parse(src))).toBe(src);
  });
});
