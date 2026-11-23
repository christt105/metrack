import type { Migration } from '../Migration.js';

/**
 * The full server timestamp of the last time the user changed the watched or skipped episodes of a series, which
 * orders the next-episode list. Null for rows written before it existed.
 */
export const lastActivityMigration: Migration = {
  version: 37,
  name: 'last-activity',
  up: (db) => {
    db.exec('ALTER TABLE series_episode_entry ADD COLUMN last_activity_at TEXT');
  },
};
