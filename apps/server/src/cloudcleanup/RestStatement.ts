import type { SqlValue } from '../storage/mapping/SqlValue.js';

/** One statement with its values, as the D1 REST API takes it. */
export interface RestStatement {
  sql: string;
  params: SqlValue[];
}
