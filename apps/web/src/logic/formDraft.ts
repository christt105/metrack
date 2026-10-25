import type { FieldSchema } from './FieldSchema';

export type DraftValue = string | boolean;
export type Draft = Record<string, DraftValue>;

/** Raised when a draft value cannot be turned into the field's type. */
export class DraftError extends Error {
  constructor(
    readonly key: string,
    message: string,
  ) {
    super(message);
    this.name = 'DraftError';
  }
}

function toDraftValue(schema: FieldSchema, value: unknown): DraftValue {
  if (schema.kind === 'boolean') return value === true;
  if (schema.kind === 'list') return Array.isArray(value) ? value.join(', ') : '';
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Converts an entity to the strings the inputs edit. */
export function toDraft(schemas: FieldSchema[], entity: object): Draft {
  const record = entity as Record<string, unknown>;
  const draft: Draft = {};
  for (const schema of schemas) draft[schema.key] = toDraftValue(schema, record[schema.key]);
  return draft;
}

/** Splits a comma separated list, dropping blanks and repeated values. */
export function parseList(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(',')) {
    const value = part.trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

function fromDraftValue(schema: FieldSchema, value: DraftValue): unknown {
  if (schema.kind === 'boolean') return value === true;
  const text = String(value).trim();
  switch (schema.kind) {
    case 'list':
      return parseList(text);
    case 'integer': {
      if (!text) return null;
      const number = Number(text);
      if (!Number.isInteger(number) || number < 0) throw new DraftError(schema.key, 'whole number');
      return number;
    }
    case 'rating': {
      if (!text) return null;
      const number = Number(text);
      if (!Number.isFinite(number) || number < 0 || number > 10)
        throw new DraftError(schema.key, '0 to 10');
      return number;
    }
    default:
      return text === '' ? null : text;
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Builds the PATCH body with only the fields whose value differs from the entity. A required text
 * field left blank raises a `DraftError`.
 */
export function buildPatch(
  schemas: FieldSchema[],
  entity: object,
  draft: Draft,
): Record<string, unknown> {
  const record = entity as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const schema of schemas) {
    const raw = draft[schema.key];
    if (raw === undefined) continue;
    const value = fromDraftValue(schema, raw);
    if (schema.required && value === null) throw new DraftError(schema.key, 'required');
    const current = record[schema.key] ?? (schema.kind === 'list' ? [] : null);
    if (!sameValue(value, current)) patch[schema.key] = value;
  }
  return patch;
}
