import type { MediaTableSpec } from './MediaTableSpec.js';

/** The user's entities joined to their entry; binds the user id first. Callers append a `WHERE`. */
export function selectMedia(spec: MediaTableSpec<{ id: number }>): string {
  const entry = spec.entryColumns.map((column) => `e.${column}`).join(', ');
  return `SELECT c.*, ${entry}, e.overrides AS overrides FROM ${spec.table} c
      JOIN ${spec.table}_entry e ON e.${spec.table}_id = c.id AND e.user_id = ?`;
}

/** The column prefixed with the alias of the table that holds it. */
export function qualifyColumn(spec: MediaTableSpec<{ id: number }>, column: string): string {
  return `${spec.entryColumns.includes(column) ? 'e' : 'c'}.${column}`;
}

/** The lookup of a catalog row by one of its keys. */
export function findCatalogSql(spec: MediaTableSpec<{ id: number }>, columns: readonly string[]) {
  return `SELECT id FROM ${spec.table} WHERE ${columns.map((column) => `${column} = ?`).join(' AND ')}`;
}

export function insertSql(table: string, columns: readonly string[]): string {
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
}

/** Most ids one `IN` list binds, under D1's limit of 100 bound parameters per query. */
export const MAX_IDS_PER_QUERY = 90;

/** `?` placeholders for an `IN` list of this many values. */
export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}
