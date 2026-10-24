/** Trimmed string, or null for missing, empty or non-scalar values. */
export function readText(value: unknown): string | null {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export type IntegerRead = { value: number | null; invalid: boolean };

/** Positive-or-zero integer from a number or numeric string. Empty values are not invalid. */
export function readInteger(value: unknown): IntegerRead {
  const raw = readText(value);
  if (raw === null) return { value: null, invalid: false };
  if (!/^\d+$/.test(raw)) return { value: null, invalid: true };
  return { value: Number(raw), invalid: false };
}

/** List of non-empty strings. A scalar becomes a one-item list. */
export function readList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items.map(readText).filter((item): item is string => item !== null);
}
