import type { Migration } from '../Migration.js';

/**
 * Per-episode tracking. `season_episodes` is the shared catalog of one season's episodes (one JSON row per
 * season), `season_episode_entry` holds what each user watched of a season (one JSON row per season and user),
 * and `season_entry.watched_count` caches how many distinct episodes that is so the library list needs no extra
 * rows. A completed season starts with every episode counted as watched.
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
        fetched_at TEXT NOT NULL
      );

      CREATE TABLE season_episode_entry (
        user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
        season_id INTEGER NOT NULL REFERENCES season (id) ON DELETE CASCADE,
        watched TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (user_id, season_id)
      );

      CREATE INDEX season_episode_entry_season ON season_episode_entry (season_id);

      ALTER TABLE season_entry ADD COLUMN watched_count INTEGER NOT NULL DEFAULT 0;

      UPDATE season_entry SET watched_count = COALESCE((SELECT episode_count FROM season WHERE season.id = season_entry.season_id), 0) WHERE status = 'completed';
    `);
  },
};
