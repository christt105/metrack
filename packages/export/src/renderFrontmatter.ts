import { stringify } from 'yaml';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A value written as a bare YAML date so Hugo reads it as a time. */
export class DateValue {
  constructor(readonly iso: string) {
    if (!DATE.test(iso)) throw new Error(`Not an ISO date: ${iso}`);
  }
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function scalar(value: unknown): string {
  return value instanceof DateValue ? value.iso : stringify(value, { version: '1.1' }).trimEnd();
}

/**
 * Renders front matter with keys in alphabetical order and empty values left out. Dates are
 * bare, everything else follows YAML 1.1 quoting so Hugo never reads a title as a boolean.
 */
export function renderFrontmatter(fields: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const key of Object.keys(fields).sort()) {
    const value = fields[key];
    if (isEmpty(value)) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value)
        lines.push(
          `  - ${scalar(typeof item === 'string' ? item.replace(/\s*\n\s*/g, ' ') : item)}`,
        );
    } else if (typeof value === 'string' && value.includes('\n')) {
      lines.push(stringify({ [key]: value }, { version: '1.1', lineWidth: 0 }).trimEnd());
    } else {
      lines.push(`${key}: ${scalar(value)}`);
    }
  }
  return `---\n${lines.join('\n')}\n---\n`;
}
