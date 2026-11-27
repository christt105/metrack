import { Miniflare } from 'miniflare';
import type { D1Database } from '../../src/storage/d1/D1Database.js';
import { applyD1Migrations } from './d1Migrations.js';
import { D1Harness } from './D1Harness.js';
import type { StorageBackend } from './StorageBackend.js';

export const D1_OWNER = `INSERT INTO user (id, name, email, created_at, role)
VALUES (1, 'Owner', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'owner')`;

/** Local D1 under Miniflare, one database per file that is emptied and re-seeded on every `open`. */
export function createD1Backend(): StorageBackend {
  let miniflare: Miniflare | undefined;
  let database: D1Database | undefined;

  async function connect(): Promise<D1Database> {
    const instance = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response(null); } };',
      d1Databases: { DB: 'metrack-test' },
    });
    try {
      const db = (await instance.getD1Database('DB')) as unknown as D1Database;
      await applyD1Migrations(db);
      await db.prepare(D1_OWNER).run();
      miniflare = instance;
      database = db;
      return db;
    } catch (error) {
      await instance.dispose();
      throw error;
    }
  }

  return {
    name: 'd1',
    async open() {
      if (!database) return new D1Harness(await connect());
      const db = database;
      const tables = (
        await db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
          )
          .all()
      ).results.map((row) => String(row.name));
      await db.batch([
        db.prepare('PRAGMA defer_foreign_keys = true'),
        ...tables.map((name) => db.prepare(`DELETE FROM "${name}"`)),
        db.prepare(D1_OWNER),
      ]);
      return new D1Harness(db);
    },
    async dispose() {
      await miniflare?.dispose();
      miniflare = undefined;
      database = undefined;
    },
  };
}
