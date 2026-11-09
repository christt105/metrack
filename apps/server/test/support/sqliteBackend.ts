import type { DatabaseSync } from 'node:sqlite';
import { createSqliteRepositories } from '../../src/storage/sqlite/createSqliteRepositories.js';
import type { SqlValue } from '../../src/storage/mapping/SqlValue.js';
import type { UserScope } from '../../src/users/UserScope.js';
import { openTestDatabase } from './openTestDatabase.js';
import type { StorageBackend } from './StorageBackend.js';
import type { StorageHarness } from './StorageHarness.js';

class SqliteHarness implements StorageHarness {
  constructor(private readonly db: DatabaseSync) {}

  repositories(scope: UserScope) {
    return createSqliteRepositories(this.db, scope);
  }

  async query(sql: string, ...params: SqlValue[]) {
    return this.db.prepare(sql).all(...params);
  }

  async run(sql: string, ...params: SqlValue[]) {
    this.db.prepare(sql).run(...params);
  }

  async explain(sql: string, ...params: SqlValue[]) {
    return this.db
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all(...params)
      .map((row) => String(row.detail));
  }
}

export const sqliteBackend: StorageBackend = {
  name: 'sqlite',
  async open() {
    const db = openTestDatabase();
    db.exec('PRAGMA foreign_keys = ON');
    return new SqliteHarness(db);
  },
  async dispose() {},
};
