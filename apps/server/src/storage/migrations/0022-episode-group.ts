import type { Migration } from '../Migration.js';

/** Lets a series number its seasons by a TMDB episode group instead of the regular TMDB seasons. */
export const episodeGroupMigration: Migration = {
  version: 22,
  name: 'episode-group',
  up: (db) => {
    db.exec('ALTER TABLE series ADD COLUMN tmdb_episode_group TEXT;');
  },
};
