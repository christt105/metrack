import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { D1Database } from '../../src/storage/d1/D1Database.js';
import { createD1Repositories } from '../../src/storage/d1/createD1Repositories.js';
import type { SqlValue } from '../../src/storage/mapping/SqlValue.js';
import type { UserScope } from '../../src/users/UserScope.js';
import type { StorageBackend } from './StorageBackend.js';
import type { StorageHarness } from './StorageHarness.js';

const SCHEMA = readFileSync(new URL('../../d1/migrations/0001_schema.sql', import.meta.url), 'utf8')
  .split(/;\s*\n/)
  .map((sql) => sql.trim())
  .filter((sql) => sql.length > 0);

class D1Harness implements StorageHarness {
  constructor(private readonly db: D1Database) {}

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

/** Local D1 under Miniflare, one database per file that is emptied and re-seeded on every `open`. */
export function createD1Backend(): StorageBackend {
  let miniflare: Miniflare | undefined;
  let database: D1Database | undefined;

  async function connect(): Promise<D1Database> {
    if (database) return database;
    miniflare = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response(null); } };',
      d1Databases: { DB: 'metrack-test' },
    });
    database = (await miniflare.getD1Database('DB')) as unknown as D1Database;
    return database;
  }

  return {
    name: 'd1',
    async open() {
      const db = await connect();
      const tables = (
        await db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
          )
          .all()
      ).results.map((row) => String(row.name));
      if (tables.length === 0) {
        await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
      } else {
        await db.batch([
          db.prepare('PRAGMA defer_foreign_keys = true'),
          ...tables.map((name) => db.prepare(`DELETE FROM "${name}"`)),
          ...SCHEMA.filter((sql) => sql.startsWith('INSERT')).map((sql) => db.prepare(sql)),
        ]);
      }
      return new D1Harness(db);
    },
    async dispose() {
      await miniflare?.dispose();
      miniflare = undefined;
      database = undefined;
    },
  };
}
