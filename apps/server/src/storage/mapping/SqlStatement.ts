import type { SqlValue } from './SqlValue.js';

/** A statement and the values to bind to it. */
export interface SqlStatement {
  sql: string;
  params: SqlValue[];
}
