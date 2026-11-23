import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runSeasonCacheCommand } from '../src/seasons/runSeasonCacheCommand.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { openDatabase } from '../src/storage/sqlite/openDatabase.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'metrack-season-cache-'));
  const db = openDatabase(join(dir, 'metrack.db'));
  new MigrationRunner(db, migrations).run();
  db.prepare('INSERT INTO series (tmdb_id, title) VALUES (4242, ?)').run('Show');
  db.prepare(
    'INSERT INTO season (series_id, number, tmdb_season_number, episode_count) VALUES (1, 1, 1, 1)',
  ).run();
  db.prepare('INSERT INTO series_entry (user_id, series_id) VALUES (1, 1)').run();
  db.prepare(
    `INSERT INTO season_entry (user_id, season_id, status, started_at, finished_at, rewatches, watched_count)
     VALUES (1, 1, 'in_progress', '2026-01-01', NULL, '[]', 0)`,
  ).run();
  db.prepare(
    `INSERT INTO season_episodes (season_id, episodes, source, fetched_at, complete)
     VALUES (1, ?, 'tmdb', '2026-01-01T00:00:00.000Z', 1)`,
  ).run(JSON.stringify([{ number: 1, tmdbId: 101, title: 'One', airDate: '2026-01-01' }]));
  db.prepare(
    "INSERT INTO series_episode_entry (user_id, series_id, watched, skipped) VALUES (1, 1, ?, '[]')",
  ).run(JSON.stringify({ '101': [{ startedAt: '2026-01-02', finishedAt: '2026-01-03' }] }));
  db.close();
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('metrack season-cache', () => {
  it('lists the entries that differ without changing them, and repairs them on request', async () => {
    const listed = await runSeasonCacheCommand({ dataDir: dir, repair: false });
    expect(listed).toContain('user 1 series 1 season 1: status, startedAt, finishedAt');
    expect(listed).toContain('1 season entries differ in 1 series');
    expect(await runSeasonCacheCommand({ dataDir: dir, repair: false })).toBe(listed);
    const repaired = await runSeasonCacheCommand({ dataDir: dir, repair: true });
    expect(repaired).toContain('(repaired)');
    expect(await runSeasonCacheCommand({ dataDir: dir, repair: false })).toBe(
      '0 season entries differ in 1 series',
    );
  });

  it('only checks the user asked for', async () => {
    expect(await runSeasonCacheCommand({ dataDir: dir, userId: 2, repair: false })).toBe(
      '0 season entries differ in 0 series',
    );
  });
});
