import type { Migration } from '../Migration.js';

/** Stores the next announced episode of a series on its catalog row, as the release check last saw it. */
export const nextEpisodeMigration: Migration = {
  version: 24,
  name: 'next-episode',
  up: (db) => {
    db.exec(`
      ALTER TABLE series ADD COLUMN next_episode_season INTEGER;
      ALTER TABLE series ADD COLUMN next_episode_number INTEGER;
      ALTER TABLE series ADD COLUMN next_episode_air_date TEXT;
      ALTER TABLE series ADD COLUMN next_episode_name TEXT;
      ALTER TABLE series ADD COLUMN next_episode_checked_at TEXT;
    `);
  },
};
