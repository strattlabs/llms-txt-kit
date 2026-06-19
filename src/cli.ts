#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './generate.js';
import { validate } from './validate.js';
import type { Diagnostic } from './types.js';

const HELP = `llms-txt — generate and validate llms.txt / llms-full.txt

Usage:
  llms-txt generate --content <dir> --base-url <url> [options]
  llms-txt validate <file> [options]

Commands:
  generate    Crawl a content directory and emit llms.txt + llms-full.txt
  validate    Lint an existing llms.txt against the spec

generate options:
  --content <dir>     Directory of Markdown files to index   (required)
  --base-url <url>    Absolute base URL for derived links     (required)
  --title <text>      Site title (H1); defaults to the host
  --summary <text>    One-line summary blockquote
  --out <dir>         Output directory                        (default: .)
  --default-section <name>   Section for files declaring none (default: Docs)
  --stdout            Print llms.txt to stdout instead of writing files

validate options:
  --strict            Treat warnings as failures
  --quiet             Print only on failure
  --no-absolute-urls  Do not warn about relative URLs

Global:
  -h, --help          Show this help
  -v, --version       Show version
`;

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    process.stdout.write(HELP);
    return 0;
  }
  if (args.includes('-v') || args.includes('--version')) {
    process.stdout.write(`${await readVersion()}\n`);
    return 0;
  }

  const [command, ...rest] = args;
  switch (command) {
    case 'generate':
      return runGenerate(parseFlags(rest));
    case 'validate':
      return runValidate(rest);
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      return 2;
  }
}

interface Flags {
  positionals: string[];
  options: Record<string, string | boolean>;
}

function parseFlags(args: string[]): Flags {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, options };
}

async function runGenerate(flags: Flags): Promise<number> {
  const { options } = flags;
  const content = str(options['content']);
  const baseUrl = str(options['base-url']);
  if (!content || !baseUrl) {
    process.stderr.write('generate requires --content <dir> and --base-url <url>\n');
    return 2;
  }

  const result = await generate({
    contentDir: content,
    baseUrl,
    ...(str(options['title']) ? { title: str(options['title'])! } : {}),
    ...(str(options['summary']) ? { summary: str(options['summary'])! } : {}),
    ...(str(options['default-section'])
      ? { defaultSection: str(options['default-section'])! }
      : {}),
  });

  if (options['stdout'] === true) {
    process.stdout.write(result.llmsTxt);
    return 0;
  }

  const outDir = str(options['out']) ?? '.';
  const txtPath = path.join(outDir, 'llms.txt');
  const fullPath = path.join(outDir, 'llms-full.txt');
  await writeFile(txtPath, result.llmsTxt, 'utf8');
  await writeFile(fullPath, result.llmsFullTxt, 'utf8');
  process.stdout.write(
    `Wrote ${result.entries.length} entr${result.entries.length === 1 ? 'y' : 'ies'} → ${txtPath}, ${fullPath}\n`,
  );
  return 0;
}

async function runValidate(args: string[]): Promise<number> {
  const { positionals, options } = parseFlags(args);
  const file = positionals[0];
  if (!file) {
    process.stderr.write('validate requires a file path: llms-txt validate <file>\n');
    return 2;
  }

  let source: string;
  try {
    source = await readFile(file, 'utf8');
  } catch {
    process.stderr.write(`Cannot read file: ${file}\n`);
    return 2;
  }

  const result = validate(source, {
    preferAbsoluteUrls: options['no-absolute-urls'] !== true,
  });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  const warnings = result.diagnostics.filter((d) => d.severity === 'warning');
  const strict = options['strict'] === true;
  const failed = errors.length > 0 || (strict && warnings.length > 0);

  if (!(options['quiet'] === true && !failed)) {
    for (const d of result.diagnostics) {
      process.stdout.write(`${formatDiagnostic(file, d)}\n`);
    }
    const summary = `${errors.length} error(s), ${warnings.length} warning(s)`;
    process.stdout.write(`${failed ? '✗' : '✓'} ${file}: ${summary}\n`);
  }

  return failed ? 1 : 0;
}

function formatDiagnostic(file: string, d: Diagnostic): string {
  const loc = d.line !== undefined ? `${file}:${d.line}` : file;
  return `  ${loc} ${d.severity} ${d.rule} ${d.message}`;
}

function str(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

async function readVersion(): Promise<string> {
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(await readFile(fileURLToPath(pkgUrl), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

main(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
