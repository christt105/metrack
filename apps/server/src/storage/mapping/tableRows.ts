import type { MediaTableSpec } from './MediaTableSpec.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';

/** Splits mapped columns into those of the catalog row and those of the user's entry. */
export function splitRow(
  entryColumns: ReadonlySet<string>,
  values: RowValues,
): { catalog: RowValues; entry: RowValues } {
  const catalog: RowValues = {};
  const entry: RowValues = {};
  for (const [column, value] of Object.entries(values)) {
    (entryColumns.has(column) ? entry : catalog)[column] = value;
  }
  return { catalog, entry };
}

export function changedColumns(before: Row, after: RowValues): string[] {
  return Object.keys(after).filter(
    (column) => (after[column] ?? null) !== (before[column] ?? null),
  );
}

export function assignments(values: RowValues): string {
  return Object.keys(values)
    .map((column) => `${column} = ?`)
    .join(', ');
}

export function withoutId<T extends { id: number }>(entity: T): Omit<T, 'id'> {
  const rest: Partial<T> = { ...entity };
  delete rest.id;
  return rest as Omit<T, 'id'>;
}

export function parseOverrides(value: unknown): Record<string, unknown> {
  return JSON.parse(String(value)) as Record<string, unknown>;
}

/** Whether the catalog values carry at least one complete key. */
export function hasKey(spec: MediaTableSpec<{ id: number }>, catalog: RowValues): boolean {
  return spec.catalogKeys.some((columns) =>
    columns.every((column) => catalog[column] !== null && catalog[column] !== undefined),
  );
}

/** The catalog values of a new row, owned by the user when it is hand-added and keyless. */
export function ownedCatalog(
  spec: MediaTableSpec<{ id: number }>,
  catalog: RowValues,
  userId: number,
): RowValues {
  return spec.ownable && !hasKey(spec, catalog) ? { ...catalog, owner_id: userId } : catalog;
}

/** The catalog values to write, with the owner cleared once the row has a key and is shared. */
export function releasedCatalog(
  spec: MediaTableSpec<{ id: number }>,
  catalog: RowValues,
): RowValues {
  return spec.ownable && hasKey(spec, catalog) ? { ...catalog, owner_id: null } : catalog;
}
