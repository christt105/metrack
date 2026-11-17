import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';

const TABLES = ['movie_entry', 'season_entry', 'videogame_entry', 'book_entry'];

const d1Sql = readFileSync(
  new URL('../d1/migrations/0008_rewatch_viewings.sql', import.meta.url),
  'utf8',
);

function legacyDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  new MigrationRunner(
    db,
    migrations.filter((migration) => migration.version < 25),
  ).run();
  db.exec(`
    INSERT INTO movie (id, title) VALUES (1, 'A'), (2, 'B'), (3, 'C');
    INSERT INTO movie_entry (user_id, movie_id, rewatches) VALUES
      (1, 1, '["2026-05-01","2026-02-01"]'),
      (1, 2, '[]'),
      (1, 3, '[{"startedAt":"2026-01-01","finishedAt":"2026-01-02"}]');
  `);
  return db;
}

const rewatchesOf = (db: DatabaseSync, id: number): unknown =>
  JSON.parse(
    String(db.prepare('SELECT rewatches FROM movie_entry WHERE movie_id = ?').get(id)?.rewatches),
  );

describe('the rewatch viewings migration', () => {
  it('turns finish dates into sorted viewings without a start, in the TypeScript migration', () => {
    const db = legacyDatabase();
    new MigrationRunner(db, migrations).run();
    expect(rewatchesOf(db, 1)).toEqual([
      { startedAt: null, finishedAt: '2026-02-01' },
      { startedAt: null, finishedAt: '2026-05-01' },
    ]);
    expect(rewatchesOf(db, 2)).toEqual([]);
    expect(rewatchesOf(db, 3)).toEqual([{ startedAt: '2026-01-01', finishedAt: '2026-01-02' }]);
  });

  it('does the same in the D1 SQL migration and covers every entry table', () => {
    const db = legacyDatabase();
    db.exec(d1Sql);
    expect(rewatchesOf(db, 1)).toEqual([
      { startedAt: null, finishedAt: '2026-02-01' },
      { startedAt: null, finishedAt: '2026-05-01' },
    ]);
    expect(rewatchesOf(db, 3)).toEqual([{ startedAt: '2026-01-01', finishedAt: '2026-01-02' }]);
    for (const table of TABLES) expect(d1Sql).toContain(`UPDATE ${table} SET`);
  });
});
