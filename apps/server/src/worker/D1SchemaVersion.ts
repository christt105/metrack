import type { SchemaVersionSource } from '../storage/SchemaVersionSource.js';
import type { D1Database } from '../storage/d1/D1Database.js';

/** The number of migrations wrangler has applied to the database; 0 while none has. */
export class D1SchemaVersion implements SchemaVersionSource {
  constructor(private readonly db: D1Database) {}

  async currentVersion(): Promise<number> {
    try {
      const row = await this.db.prepare('SELECT COUNT(*) AS n FROM d1_migrations').first();
      return Number(row?.n ?? 0);
    } catch {
      return 0;
    }
  }
}
