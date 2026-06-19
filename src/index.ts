/**
 * llms-txt-kit — generate and validate `llms.txt` / `llms-full.txt`.
 *
 * Public, stable API surface. The CLI in `cli.ts` is a thin wrapper over these
 * exports; anything importable here is intended for programmatic use.
 *
 * @see https://llmstxt.org for the file-format specification.
 */
export type {
  Diagnostic,
  LlmsDocument,
  LlmsLink,
  LlmsSection,
  Severity,
  ValidationResult,
} from './types.js';

export { parse, parseWithDiagnostics } from './parse.js';
export { format } from './format.js';
export { validate, validateDocument } from './validate.js';
export type { ValidateOptions } from './validate.js';
export { generate } from './generate.js';
export type { GenerateOptions, GenerateResult, GeneratedEntry } from './generate.js';
export { parseFrontmatter } from './frontmatter.js';
