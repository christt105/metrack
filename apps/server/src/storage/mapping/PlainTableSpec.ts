import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';

/** How one entity is stored as rows of a single table that carries a `user_id`. */
export interface PlainTableSpec<T extends { id: number }> {
  table: string;
  toRow(entity: Omit<T, 'id'>): RowValues;
  fromRow(row: Row): T;
}
