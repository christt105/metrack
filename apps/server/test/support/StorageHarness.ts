import type { Row } from '../../src/storage/mapping/Row.js';
import type { SqlValue } from '../../src/storage/mapping/SqlValue.js';
import type { Repositories } from '../../src/storage/repositories/Repositories.js';
import type { UserScope } from '../../src/users/UserScope.js';

/** One empty database with the current schema, reachable through the repositories and through raw SQL. */
export interface StorageHarness {
  repositories(scope: UserScope): Repositories;
  query(sql: string, ...params: SqlValue[]): Promise<Row[]>;
  run(sql: string, ...params: SqlValue[]): Promise<void>;
  explain(sql: string, ...params: SqlValue[]): Promise<string[]>;
}
