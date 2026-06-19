import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { asBool, parseFrontmatter } from './frontmatter.js';
import { format } from './format.js';
import type { LlmsDocument, LlmsLink, LlmsSection } from './types.js';

/** Options for {@link generate}. */
export interface GenerateOptions {
  /** Directory tree of Markdown files to index. */
  contentDir: string;
  /** Absolute base URL for derived links, e.g. `https://example.com`. */
  baseUrl: string;
  /** Site title (the H1). Defaults to the base URL's hostname. */
  title?: string;
  /** Summary blockquote placed under the title. */
  summary?: string;
  /** File extensions to include. Defaults to `.md` and `.markdown`. */
  extensions?: string[];
  /** Section used when a file declares none. Defaults to `Docs`. */
  defaultSection?: string;
}

/** Metadata for one Markdown file discovered during generation. */
export interface GeneratedEntry {
  relativePath: string;
  url: string;
  title: string;
  description?: string;
  section: string;
  order?: number;
  body: string;
}

/** Result of {@link generate}. */
export interface GenerateResult {
  document: LlmsDocument;
  /** Serialized, spec-compliant `llms.txt`. */
  llmsTxt: string;
  /** Serialized `llms-full.txt` with every document's full content inlined. */
  llmsFullTxt: string;
  /** The discovered entries, in output order. */
  entries: GeneratedEntry[];
}

const DEFAULT_EXTENSIONS = ['.md', '.markdown'];

/**
 * Crawl a content directory and produce `llms.txt` (an index) and
 * `llms-full.txt` (full inlined content).
 *
 * Per-file metadata comes from optional YAML frontmatter (`title`,
 * `description`, `section`, `order`, `url`, `draft`); sensible fallbacks are
 * derived from the document body and file path when frontmatter is absent.
 */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const defaultSection = options.defaultSection ?? 'Docs';
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const title = options.title ?? hostnameOf(baseUrl);

  const files = await walk(options.contentDir, extensions);
  const entries: GeneratedEntry[] = [];

  for (const absolutePath of files) {
    const relativePath = path.relative(options.contentDir, absolutePath);
    const source = await readFile(absolutePath, 'utf8');
    const { data, body } = parseFrontmatter(source);
    if (asBool(data['draft'])) continue;

    const description = deriveDescription(data['description'], body);
    const orderRaw = data['order'];
    const hasOrder = orderRaw !== undefined && Number.isFinite(Number(orderRaw));

    entries.push({
      relativePath,
      url: data['url'] ?? deriveUrl(baseUrl, relativePath),
      title: data['title'] ?? deriveTitle(body, relativePath),
      ...(description !== undefined ? { description } : {}),
      section: data['section'] ?? deriveSection(relativePath, defaultSection),
      ...(hasOrder ? { order: Number(orderRaw) } : {}),
      body: body.trim(),
    });
  }

  const ordered = sortEntries(entries);
  const document = buildDocument(title, options.summary, ordered);

  return {
    document,
    llmsTxt: format(document),
    llmsFullTxt: buildFullText(title, options.summary, ordered),
    entries: ordered,
  };
}

async function walk(dir: string, extensions: string[]): Promise<string[]> {
  const out: string[] = [];
  let dirEntries;
  try {
    dirEntries = await readdir(dir, { withFileTypes: true });
  } catch {
    throw new Error(`Content directory not found or unreadable: ${dir}`);
  }
  for (const entry of dirEntries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, extensions)));
    } else if (
      entry.isFile() &&
      extensions.includes(path.extname(entry.name).toLowerCase())
    ) {
      out.push(full);
    }
  }
  return out;
}

function deriveUrl(baseUrl: string, relativePath: string): string {
  const noExt = relativePath.replace(/\.(md|markdown)$/i, '');
  const segments = noExt.split(path.sep).filter((s) => s !== '');
  if (segments[segments.length - 1] === 'index') segments.pop();
  const slug = segments.map(encodeURIComponent).join('/');
  return slug === '' ? `${baseUrl}/` : `${baseUrl}/${slug}`;
}

function deriveSection(relativePath: string, fallback: string): string {
  const segments = relativePath.split(path.sep);
  return segments.length > 1 ? humanize(segments[0]!) : fallback;
}

function deriveTitle(body: string, relativePath: string): string {
  const h1 = /^#\s+(.*\S)\s*$/m.exec(body);
  if (h1) return h1[1]!.trim();
  const base = path.basename(relativePath).replace(/\.(md|markdown)$/i, '');
  return humanize(base);
}

function deriveDescription(
  explicit: string | undefined,
  body: string,
): string | undefined {
  if (explicit && explicit.trim() !== '') return explicit.trim();
  // First non-heading, non-blank line of prose.
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (t === '' || t.startsWith('#') || t.startsWith('>') || t.startsWith('-')) continue;
    return t.length > 200 ? `${t.slice(0, 197).trimEnd()}…` : t;
  }
  return undefined;
}

function humanize(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortEntries(entries: GeneratedEntry[]): GeneratedEntry[] {
  return [...entries].sort((a, b) => {
    const sa = sectionOrder(a.section);
    const sb = sectionOrder(b.section);
    if (sa !== sb) return sa - sb;
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    const oa = a.order ?? Number.MAX_SAFE_INTEGER;
    const ob = b.order ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.title.localeCompare(b.title);
  });
}

// "Optional" sections sort last, per the spec's special-case semantics.
function sectionOrder(section: string): number {
  return section.trim().toLowerCase() === 'optional' ? 1 : 0;
}

function buildDocument(
  title: string,
  summary: string | undefined,
  entries: GeneratedEntry[],
): LlmsDocument {
  const sectionsByName = new Map<string, LlmsSection>();
  for (const entry of entries) {
    let section = sectionsByName.get(entry.section);
    if (!section) {
      section = {
        title: entry.section,
        links: [],
        optional: entry.section.trim().toLowerCase() === 'optional',
      };
      sectionsByName.set(entry.section, section);
    }
    const link: LlmsLink = {
      title: entry.title,
      url: entry.url,
      ...(entry.description ? { notes: entry.description } : {}),
    };
    section.links.push(link);
  }

  return {
    title,
    sections: [...sectionsByName.values()],
    ...(summary && summary.trim() !== '' ? { summary: summary.trim() } : {}),
  };
}

function buildFullText(
  title: string,
  summary: string | undefined,
  entries: GeneratedEntry[],
): string {
  const blocks: string[] = [`# ${title.trim()}`];
  if (summary && summary.trim() !== '') blocks.push(`> ${summary.trim()}`);
  for (const entry of entries) {
    const header = `## ${entry.title}\n\nSource: ${entry.url}`;
    blocks.push(entry.body ? `${header}\n\n${stripLeadingH1(entry.body)}` : header);
  }
  return blocks.join('\n\n') + '\n';
}

// Avoid a second H1 inside the full-text dump; the file already opens with one.
function stripLeadingH1(body: string): string {
  return body.replace(/^#\s+.*\S\s*\r?\n+/, '').trimStart();
}

function hostnameOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return baseUrl;
  }
}
