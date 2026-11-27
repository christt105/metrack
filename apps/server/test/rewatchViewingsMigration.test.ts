import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { applyD1MigrationsToSqlite } from './support/d1Migrations.js';

function seedLegacyDatabase(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO movie (id, title) VALUES (1, 'A'), (2, 'B'), (3, 'C');
    INSERT INTO movie_entry (user_id, movie_id, rewatches) VALUES
      (1, 1, '["2026-05-01","2026-02-01"]'),
      (1, 2, '[]'),
      (1, 3, '[{"startedAt":"2026-01-01","finishedAt":"2026-01-02"}]');
    INSERT INTO series (id, title) VALUES (1, 'S');
    INSERT INTO season (id, series_id, number) VALUES (1, 1, 1);
    INSERT INTO season_entry (user_id, season_id, rewatches) VALUES (1, 1, '["2026-02-01"]');
    INSERT INTO videogame (id, title) VALUES (1, 'G');
    INSERT INTO videogame_entry (user_id, videogame_id, rewatches) VALUES (1, 1, '["2026-02-01"]');
    INSERT INTO book (id, title) VALUES (1, 'B');
    INSERT INTO book_entry (user_id, book_id, rewatches) VALUES (1, 1, '["2026-02-01"]');
  `);
}

function legacySqlite(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  new MigrationRunner(
    db,
    migrations.filter((migration) => migration.version < 25),
  ).run();
  seedLegacyDatabase(db);
  return db;
}

const rewatchesOf = (db: DatabaseSync, id: number): unknown =>
  JSON.parse(
    String(db.prepare('SELECT rewatches FROM movie_entry WHERE movie_id = ?').get(id)?.rewatches),
  );

describe('the rewatch viewings migration', () => {
  it('turns finish dates into sorted viewings without a start, in the TypeScript migration', () => {
    const db = legacySqlite();
    new MigrationRunner(db, migrations).run();
    expect(rewatchesOf(db, 1)).toEqual([
      { startedAt: null, finishedAt: '2026-02-01' },
      { startedAt: null, finishedAt: '2026-05-01' },
    ]);
    expect(rewatchesOf(db, 2)).toEqual([]);
    expect(rewatchesOf(db, 3)).toEqual([{ startedAt: '2026-01-01', finishedAt: '2026-01-02' }]);
  });

  it('does the same in the D1 SQL migration and covers every entry table', () => {
    const db = new DatabaseSync(':memory:');
    applyD1MigrationsToSqlite(db, { through: 7 });
    db.exec(
      "INSERT INTO user (id, name, created_at, role) VALUES (1, 'Owner', '2026-01-01', 'owner')",
    );
    seedLegacyDatabase(db);
    applyD1MigrationsToSqlite(db, { after: 7, through: 8 });
    expect(rewatchesOf(db, 1)).toEqual([
      { startedAt: null, finishedAt: '2026-02-01' },
      { startedAt: null, finishedAt: '2026-05-01' },
    ]);
    expect(rewatchesOf(db, 3)).toEqual([{ startedAt: '2026-01-01', finishedAt: '2026-01-02' }]);
    for (const table of ['season_entry', 'videogame_entry', 'book_entry']) {
      expect(db.prepare(`SELECT rewatches FROM ${table} WHERE user_id = 1`).get(), table).toEqual({
        rewatches: '[{"startedAt":null,"finishedAt":"2026-02-01"}]',
      });
    }
  });
});
