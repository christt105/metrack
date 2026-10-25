import { parse } from 'yaml';

export interface ParsedNote {
  frontmatter: Record<string, unknown>;
  body: string;
}

const BOM = String.fromCharCode(0xfeff);
const FENCE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** Splits a note into its YAML frontmatter and body. Throws when the YAML is invalid. */
export function parseFrontmatter(source: string): ParsedNote {
  const text = source.startsWith(BOM) ? source.slice(1) : source;
  const match = FENCE.exec(text);
  if (!match) return { frontmatter: {}, body: text };
  const data: unknown = parse(match[1] ?? '', { schema: 'core' });
  const frontmatter =
    data !== null && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  return { frontmatter, body: text.slice(match[0].length) };
}
