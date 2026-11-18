import type { Migration } from '../Migration.js';

/**
 * `season_episodes.refill` holds the episodes fetched so far when a complete catalog that went stale is refetched
 * in chunks, so the complete catalog keeps being served until the new one is complete.
 */
export const seasonEpisodesRefillMigration: Migration = {
  version: 27,
  name: 'season-episodes-refill',
  up: (db) => {
    db.exec('ALTER TABLE season_episodes ADD COLUMN refill TEXT');
  },
};
