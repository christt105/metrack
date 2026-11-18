import type { Migration } from '../Migration.js';

/**
 * Per-episode tracking. `season_episodes` is the shared catalog of one season's episodes in the series' ordering
 * (one JSON row per season, `complete` is 0 while a very large season is filled in by chunks),
 * `series_episode_entry` holds what each user watched of a series keyed by TMDB episode id (one JSON row per
 * series and user, with the keys of the episodes the user skipped: not watched, but not owed either), and `season_entry.watched_count` and `skipped_count` cache how many distinct episodes of the season are watched and skipped so
 * the library list needs no extra rows. A completed season starts with every episode counted as watched.
 */
export const seasonEpisodesMigration: Migration = {
  version: 26,
  name: 'season-episodes',
  up: (db) => {
    db.exec(`
      CREATE TABLE season_episodes (
        season_id INTEGER PRIMARY KEY REFERENCES season (id) ON DELETE CASCADE,
        episodes TEXT NOT NULL DEFAULT '[]',
        source TEXT NOT NULL CHECK (source IN ('tmdb','jellyfin')),
        fetched_at TEXT NOT NULL,
        complete INTEGER NOT NULL DEFAULT 1 CHECK (complete IN (0, 1))
      );

      CREATE TABLE series_episode_entry (
        user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
        series_id INTEGER NOT NULL REFERENCES series (id) ON DELETE CASCADE,
        watched TEXT NOT NULL DEFAULT '{}',
        skipped TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (user_id, series_id)
      );

      CREATE INDEX series_episode_entry_series ON series_episode_entry (series_id);

      ALTER TABLE season_entry ADD COLUMN watched_count INTEGER NOT NULL DEFAULT 0;

      ALTER TABLE season_entry ADD COLUMN skipped_count INTEGER NOT NULL DEFAULT 0;

      UPDATE season_entry SET watched_count = COALESCE((SELECT episode_count FROM season WHERE season.id = season_entry.season_id), 0) WHERE status = 'completed';
    `);
  },
};
