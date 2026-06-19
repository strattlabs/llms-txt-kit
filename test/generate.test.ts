import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generate } from '../src/generate.js';
import { validate } from '../src/validate.js';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'llms-kit-'));
  await writeFile(
    path.join(dir, 'index.md'),
    [
      '---',
      'title: Home',
      'description: The landing page.',
      '---',
      '',
      '# Home',
      'Welcome.',
    ].join('\n'),
  );
  await mkdir(path.join(dir, 'guides'), { recursive: true });
  await writeFile(
    path.join(dir, 'guides', 'getting-started.md'),
    [
      '---',
      'section: Guides',
      'order: 1',
      '---',
      '',
      '# Getting Started',
      'First steps here.',
    ].join('\n'),
  );
  await writeFile(
    path.join(dir, 'guides', 'advanced.md'),
    [
      '---',
      'section: Guides',
      'order: 2',
      'draft: true',
      '---',
      '',
      '# Advanced',
      'Hidden.',
    ].join('\n'),
  );
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('generate', () => {
  it('produces a valid llms.txt indexing non-draft files', async () => {
    const result = await generate({
      contentDir: dir,
      baseUrl: 'https://example.com/',
      title: 'Example',
      summary: 'An example site.',
    });

    // Draft file excluded; two entries remain.
    expect(result.entries.map((e) => e.title).sort()).toEqual([
      'Getting Started',
      'Home',
    ]);

    const home = result.entries.find((e) => e.title === 'Home');
    expect(home?.url).toBe('https://example.com/');
    expect(home?.section).toBe('Docs');

    const gs = result.entries.find((e) => e.title === 'Getting Started');
    expect(gs?.url).toBe('https://example.com/guides/getting-started');
    expect(gs?.section).toBe('Guides');

    expect(validate(result.llmsTxt).valid).toBe(true);
    expect(result.llmsTxt).toContain('# Example');
    expect(result.llmsTxt).toContain('> An example site.');
  });

  it('inlines full content into llms-full.txt without a duplicate H1', async () => {
    const result = await generate({
      contentDir: dir,
      baseUrl: 'https://example.com',
      title: 'Example',
    });

    expect(result.llmsFullTxt.startsWith('# Example')).toBe(true);
    // The per-doc H1 is stripped; the H2 header is followed by the source line
    // and then the prose directly (no second "# Getting Started" heading).
    expect(result.llmsFullTxt).toContain(
      '## Getting Started\n\nSource: https://example.com/guides/getting-started\n\nFirst steps here.',
    );
  });

  it('throws a clear error for a missing content directory', async () => {
    await expect(
      generate({ contentDir: path.join(dir, 'nope'), baseUrl: 'https://e.com' }),
    ).rejects.toThrow(/not found or unreadable/);
  });
});
