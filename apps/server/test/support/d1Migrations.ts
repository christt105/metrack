import { readFileSync, readdirSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '../../src/storage/d1/D1Database.js';

interface MigrationRange {
  after?: number;
  through?: number;
}

const directory = new URL('../../d1/migrations/', import.meta.url);

export function loadD1Migrations({ after = 0, through = Infinity }: MigrationRange = {}) {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => {
      const prefix = /^(\d+)_/.exec(name)?.[1];
      if (!prefix) throw new Error(`D1 migration has no numeric prefix: ${name}`);
      return { name, version: Number(prefix) };
    })
    .sort((a, b) => a.version - b.version)
    .filter(({ version }) => version > after && version <= through)
    .map(({ name }) => ({ name, sql: readFileSync(new URL(name, directory), 'utf8') }));
}

/** Miniflare runs each SQL script in a single transaction. */
export async function applyD1Migrations(db: D1Database, range?: MigrationRange): Promise<void> {
  for (const { name, sql } of loadD1Migrations(range)) {
    try {
      await db.batch([db.prepare(sql)]);
    } catch (cause) {
      throw new Error(`Could not apply D1 migration ${name}`, { cause });
    }
  }
}

export function applyD1MigrationsToSqlite(db: DatabaseSync, range?: MigrationRange): void {
  for (const { name, sql } of loadD1Migrations(range)) {
    try {
      db.exec(sql);
    } catch (cause) {
      throw new Error(`Could not apply D1 migration ${name}`, { cause });
    }
  }
}
