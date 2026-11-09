import type { SqlValue } from '../../src/storage/mapping/SqlValue.js';

export interface RecordedStatement {
  sql: string;
  params: SqlValue[];
}
