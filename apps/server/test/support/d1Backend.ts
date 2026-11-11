import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { D1Database } from '../../src/storage/d1/D1Database.js';
import { D1Harness } from './D1Harness.js';
import type { StorageBackend } from './StorageBackend.js';

const OWNER = `INSERT INTO user (id, name, email, created_at, role)
VALUES (1, 'Owner', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'owner')`;

const SCHEMA = ['0001_schema.sql', '0002_public_render_cache.sql'].flatMap((file) =>
  readFileSync(new URL(`../../d1/migrations/${file}`, import.meta.url), 'utf8')
    .split(/;\s*\n/)
    .map((sql) => sql.trim())
    .filter((sql) => sql.length > 0),
);

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
        await db.batch([...SCHEMA, OWNER].map((sql) => db.prepare(sql)));
      } else {
        await db.batch([
          db.prepare('PRAGMA defer_foreign_keys = true'),
          ...tables.map((name) => db.prepare(`DELETE FROM "${name}"`)),
          db.prepare(OWNER),
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
