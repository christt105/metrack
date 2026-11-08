import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';

/**
 * How one media type is stored as a shared catalog row (`table`) plus one personal entry per user
 * (`<table>_entry`, keyed by `user_id` and `<table>_id`). `entryColumns` says which columns live in the
 * entry, and `catalogKeys` the column sets that identify a catalog row. `relatedDeletes` are trusted
 * statements, run with the user id and the entity id, that remove the user's rows hanging from a deleted
 * entry. In an `ownable` table a catalog row without any key belongs to the user who created it.
 */
export interface MediaTableSpec<T extends { id: number }> {
  table: string;
  entryColumns: readonly string[];
  catalogKeys: readonly (readonly string[])[];
  relatedDeletes: readonly string[];
  ownable: boolean;
  toRow(entity: Omit<T, 'id'>): RowValues;
  fromRow(row: Row): T;
}
