import type { D1Database } from '../../src/storage/d1/D1Database.js';
import { createD1Repositories } from '../../src/storage/d1/createD1Repositories.js';
import type { SqlValue } from '../../src/storage/mapping/SqlValue.js';
import type { UserScope } from '../../src/users/UserScope.js';
import type { RecordedStatement } from './RecordedStatement.js';
import { recordStatements } from './recordStatements.js';
import type { StorageHarness } from './StorageHarness.js';

export class D1Harness implements StorageHarness {
  constructor(private readonly db: D1Database) {}

  /** The same database, with every statement the repositories bind added to `log`. */
  recording(log: RecordedStatement[]): D1Harness {
    return new D1Harness(recordStatements(this.db, log));
  }

  repositories(scope: UserScope) {
    return createD1Repositories(this.db, scope);
  }

  async query(sql: string, ...params: SqlValue[]) {
    return (
      await this.db
        .prepare(sql)
        .bind(...params)
        .all()
    ).results;
  }

  async run(sql: string, ...params: SqlValue[]) {
    await this.db
      .prepare(sql)
      .bind(...params)
      .run();
  }

  async explain(sql: string, ...params: SqlValue[]) {
    return (await this.query(`EXPLAIN QUERY PLAN ${sql}`, ...params)).map((row) =>
      String(row.detail),
    );
  }
}
