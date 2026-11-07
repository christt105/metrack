import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';

describe('data owners migration', () => {
  it('gives everything stored so far to user 1 and keeps every row and reference', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    new MigrationRunner(db, migrations.slice(0, 10)).run();
    db.exec(`
      INSERT INTO series (id, tmdb_id, title) VALUES (7, 70, 'Lupin');
      INSERT INTO series_entry (series_id, jellyfin_id, follow) VALUES (7, 'jf-s', 1);
      INSERT INTO season (id, series_id, number) VALUES (3, 7, 1);
      INSERT INTO season_entry (season_id, status, rating) VALUES (3, 'completed', 6);
      INSERT INTO movie (id, tmdb_id, title) VALUES (5, 50, 'Matrix');
      INSERT INTO movie_entry (movie_id, overrides) VALUES (5, '{"title":"The Matrix"}');
      INSERT INTO season_override (series_id, tmdb_season_number, number) VALUES (7, 2, 5);
      INSERT INTO unlinked_title (media_type, title, source, created_at) VALUES ('movie', 'X', 'jellyfin', 'now');
      INSERT INTO release_alert (subject_type, subject_id, kind, title, message, sent_at)
        VALUES ('season', 3, 'releases_today', 'Lupin', 'Today', 'now');
    `);

    new MigrationRunner(db, migrations).run();

    for (const table of [
      'movie_entry',
      'series_entry',
      'season_entry',
      'season_override',
      'unlinked_title',
      'release_alert',
    ]) {
      expect(db.prepare(`SELECT user_id FROM ${table}`).all(), table).toEqual([{ user_id: 1 }]);
    }
    expect({ ...db.prepare('SELECT * FROM movie_entry').get() }).toMatchObject({
      movie_id: 5,
      overrides: '{"title":"The Matrix"}',
    });
    expect({ ...db.prepare('SELECT * FROM season_entry').get() }).toMatchObject({
      season_id: 3,
      status: 'completed',
      rating: 6,
    });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(Number(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys)).toBe(1);
  });

  it('makes a Jellyfin id and a sent alert unique per user instead of globally', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    new MigrationRunner(db, migrations).run();
    db.exec(`
      INSERT INTO user (id, name, created_at) VALUES (2, 'Friend', 'now');
      INSERT INTO movie (id, title) VALUES (5, 'Matrix');
      INSERT INTO movie_entry (user_id, movie_id, jellyfin_id) VALUES (1, 5, 'jf-1'), (2, 5, 'jf-1');
      INSERT INTO release_alert (user_id, subject_type, subject_id, kind, title, message, sent_at)
        VALUES (1, 'movie', 5, 'releases_today', 'M', 'm', 'now'), (2, 'movie', 5, 'releases_today', 'M', 'm', 'now');
    `);
    expect(() =>
      db.exec(
        "INSERT INTO movie (id, title) VALUES (6, 'Other'); INSERT INTO movie_entry (user_id, movie_id, jellyfin_id) VALUES (1, 6, 'jf-1')",
      ),
    ).toThrow('UNIQUE');
    db.exec('DELETE FROM user WHERE id = 2');
    expect(db.prepare('SELECT COUNT(*) AS n FROM movie_entry').get()?.n).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM release_alert').get()?.n).toBe(1);
  });
});
