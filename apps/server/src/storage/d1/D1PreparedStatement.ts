import type { SqlValue } from '../mapping/SqlValue.js';
import type { Row } from '../mapping/Row.js';
import type { D1Result } from './D1Result.js';

export interface D1PreparedStatement {
  bind(...values: SqlValue[]): D1PreparedStatement;
  first(): Promise<Row | null>;
  all(): Promise<D1Result>;
  run(): Promise<D1Result>;
}
