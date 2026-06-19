import { describe, expect, it } from 'vitest';
import { asBool, parseFrontmatter } from '../src/frontmatter.js';

describe('parseFrontmatter', () => {
  it('extracts flat key/value pairs and strips the fence', () => {
    const src = [
      '---',
      'title: Getting Started',
      "description: 'How to begin'",
      'section: "Guides"',
      'draft: false',
      '---',
      '',
      '# Body',
      'Content here.',
    ].join('\n');

    const { data, body } = parseFrontmatter(src);
    expect(data).toEqual({
      title: 'Getting Started',
      description: 'How to begin',
      section: 'Guides',
      draft: 'false',
    });
    expect(body).toBe('\n# Body\nContent here.');
  });

  it('returns the source unchanged when there is no frontmatter', () => {
    const { data, body } = parseFrontmatter('# No frontmatter\n');
    expect(data).toEqual({});
    expect(body).toBe('# No frontmatter\n');
  });

  it('interprets booleans leniently', () => {
    expect(asBool('true')).toBe(true);
    expect(asBool('YES')).toBe(true);
    expect(asBool('1')).toBe(true);
    expect(asBool('false')).toBe(false);
    expect(asBool(undefined)).toBe(false);
  });
});
