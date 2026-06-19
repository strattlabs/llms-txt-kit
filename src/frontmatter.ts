/**
 * Minimal YAML-frontmatter extraction.
 *
 * Intentionally NOT a full YAML parser: it handles the leading `---` fenced
 * block and flat `key: value` scalar pairs (with optional surrounding quotes),
 * which is all the generator needs. Nested structures, lists, and multi-line
 * values are unsupported by design — keeping the kit dependency-free. Documents
 * needing richer frontmatter can pass values explicitly via the generator API.
 */
export interface Frontmatter {
  data: Record<string, string>;
  /** The document body with the frontmatter block removed. */
  body: string;
}

const FENCE_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(source: string): Frontmatter {
  const m = FENCE_RE.exec(source);
  if (!m) return { data: {}, body: source };

  const data: Record<string, string> = {};
  for (const rawLine of m[1]!.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    if (key === '') continue;
    data[key] = unquote(line.slice(sep + 1).trim());
  }

  return { data, body: source.slice(m[0].length) };
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/** Interpret a frontmatter scalar as a boolean (`true`/`yes`/`1`). */
export function asBool(value: string | undefined): boolean {
  if (value === undefined) return false;
  return /^(true|yes|1)$/i.test(value.trim());
}
