import type { Migration } from '../Migration.js';

/**
 * `season_filler` keeps what AnimeFillerList classified for the episodes of a season: its `slug` on the site and one
 * JSON object that maps each episode key to its category. It is shared, like the episode catalog, and goes with
 * its season.
 */
export const seasonFillerMigration: Migration = {
  version: 35,
  name: 'season-filler',
  up: (db) => {
    db.exec(`
      CREATE TABLE season_filler (
        season_id INTEGER PRIMARY KEY REFERENCES season (id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        categories TEXT NOT NULL DEFAULT '{}'
      );
    `);
  },
};
