import type { Migration } from '../Migration.js';

/**
 * `series_episode_entry.unmatched` holds the watched library episodes the last sync of a series could not record
 * (a JSON list), so the web can ask the user to fix them.
 */
export const unmatchedEpisodesMigration: Migration = {
  version: 29,
  name: 'unmatched-episodes',
  up: (db) => {
    db.exec("ALTER TABLE series_episode_entry ADD COLUMN unmatched TEXT NOT NULL DEFAULT '[]'");
  },
};
