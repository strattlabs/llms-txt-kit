import { describe, expect, it } from 'vitest';
import { validate } from '../src/validate.js';

const rules = (src: string, opts?: Parameters<typeof validate>[1]) =>
  validate(src, opts).diagnostics.map((d) => d.rule);

describe('validate', () => {
  it('accepts a well-formed document', () => {
    const src = [
      '# Project',
      '',
      '> A clear one-line summary.',
      '',
      '## Docs',
      '- [Start](https://e.com/start): begin here',
      '- [API](https://e.com/api)',
    ].join('\n');

    const result = validate(src);
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('fails when the H1 is missing', () => {
    const result = validate('## Docs\n- [x](https://e.com)');
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'LT001')).toBe(true);
  });

  it('warns about a missing summary', () => {
    expect(rules('# T\n\n## S\n- [a](https://e.com)')).toContain('LT009');
  });

  it('warns about empty sections', () => {
    expect(rules('# T\n\n> s\n\n## Empty')).toContain('LT003');
  });

  it('warns about duplicate URLs', () => {
    const src = [
      '# T',
      '> s',
      '## S',
      '- [a](https://e.com/x)',
      '- [b](https://e.com/x)',
    ].join('\n');
    expect(rules(src)).toContain('LT006');
  });

  it('warns about relative URLs by default and not when disabled', () => {
    const src = '# T\n\n> s\n\n## S\n- [a](/relative)';
    expect(rules(src)).toContain('LT011');
    expect(rules(src, { preferAbsoluteUrls: false })).not.toContain('LT011');
  });

  it('treats protocol-relative URLs as absolute', () => {
    expect(rules('# T\n\n> s\n\n## S\n- [a](//cdn.e.com/x)')).not.toContain('LT011');
  });

  it('warns when there are no sections', () => {
    expect(rules('# T\n\n> just a summary')).toContain('LT010');
  });

  it('does not fail validation on warnings alone', () => {
    // Missing summary + no sections are warnings, not errors.
    expect(validate('# Title only').valid).toBe(true);
  });
});
