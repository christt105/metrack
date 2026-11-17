import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';

const d1Sql = readFileSync(
  new URL('../d1/migrations/0009_season_episodes.sql', import.meta.url),
  'utf8',
);

function legacyDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  new MigrationRunner(
    db,
    migrations.filter((migration) => migration.version < 26),
  ).run();
  db.exec(`
    INSERT INTO series (id, title) VALUES (1, 'S');
    INSERT INTO season (id, series_id, number, episode_count) VALUES (1, 1, 1, 12), (2, 1, 2, NULL), (3, 1, 3, 8);
    INSERT INTO season_entry (user_id, season_id, status) VALUES
      (1, 1, 'completed'), (1, 2, 'completed'), (1, 3, 'in_progress');
  `);
  return db;
}

const counts = (db: DatabaseSync): number[] =>
  db
    .prepare('SELECT watched_count FROM season_entry ORDER BY season_id')
    .all()
    .map((row) => Number(row.watched_count));

describe('the season episodes migration', () => {
  it('counts every episode of a completed season as watched and none of the others', () => {
    const db = legacyDatabase();
    new MigrationRunner(db, migrations).run();
    expect(counts(db)).toEqual([12, 0, 0]);
  });

  it('does the same in the D1 SQL migration', () => {
    const db = legacyDatabase();
    db.exec(d1Sql);
    expect(counts(db)).toEqual([12, 0, 0]);
  });
});
