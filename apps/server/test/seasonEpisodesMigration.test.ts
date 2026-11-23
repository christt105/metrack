import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';

const d1Sql = [
  '0009_season_episodes.sql',
  '0010_season_episodes_refill.sql',
  '0012_unmatched_episodes.sql',
  '0020_last_activity.sql',
]
  .map((file) => readFileSync(new URL(`../d1/migrations/${file}`, import.meta.url), 'utf8'))
  .join('\n');

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

const columns = (db: DatabaseSync, table: string): string[] =>
  db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => String(row.name));

describe('the season episodes migration', () => {
  it.each([
    ['TypeScript', (db: DatabaseSync) => new MigrationRunner(db, migrations).run()],
    ['D1 SQL', (db: DatabaseSync) => db.exec(d1Sql)],
  ])('creates the catalog and the per-series watches in the %s migration', (_name, apply) => {
    const db = legacyDatabase();
    apply(db);
    expect(columns(db, 'season_episodes')).toEqual([
      'season_id',
      'episodes',
      'source',
      'fetched_at',
      'complete',
      'refill',
    ]);
    expect(columns(db, 'series_episode_entry')).toEqual([
      'user_id',
      'series_id',
      'watched',
      'skipped',
      'unmatched',
      'last_activity_at',
    ]);
    expect(columns(db, 'season_episode_entry')).toEqual([]);
    db.exec(
      "INSERT INTO season_episodes (season_id, source, fetched_at) VALUES (1, 'tmdb', 'now')",
    );
    expect(db.prepare('SELECT complete FROM season_episodes').get()).toEqual({ complete: 1 });
  });

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
