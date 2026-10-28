import { stringify } from 'yaml';
import { DateValue } from '../renderFrontmatter.js';

const OPTIONS = { version: '1.1', lineWidth: 0, singleQuote: false } as const;

function scalar(value: unknown): string {
  if (value instanceof DateValue) return value.iso;
  return stringify(value, OPTIONS).trimEnd();
}

function isScalarList(value: unknown[]): boolean {
  return value.every(
    (item) => item === null || typeof item !== 'object' || item instanceof DateValue,
  );
}

/**
 * Renders front matter in the given key order the way Obsidian writes it: empty values as a bare
 * key, empty lists as `[]`, dates bare. Strings follow YAML 1.1 quoting because the old Hugo
 * migration reads the notes with PyYAML.
 */
export function renderVaultFrontmatter(entries: [string, unknown][]): string {
  const lines: string[] = [];
  for (const [key, value] of entries) {
    if (value === null || value === undefined) {
      lines.push(`${key}:`);
    } else if (Array.isArray(value) && value.length === 0) {
      lines.push(`${key}: []`);
    } else if (Array.isArray(value) && isScalarList(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${scalar(item)}`);
    } else if (value instanceof DateValue || typeof value !== 'object') {
      lines.push(`${key}: ${scalar(value)}`);
    } else {
      lines.push(stringify({ [key]: value }, OPTIONS).trimEnd());
    }
  }
  return `---\n${lines.join('\n')}\n---\n`;
}
