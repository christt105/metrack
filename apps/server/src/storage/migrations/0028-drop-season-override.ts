import type { Migration } from '../Migration.js';

export const dropSeasonOverrideMigration: Migration = {
  version: 28,
  name: 'drop-season-override',
  up: (db) => {
    db.exec('DROP TABLE IF EXISTS season_override');
  },
};
