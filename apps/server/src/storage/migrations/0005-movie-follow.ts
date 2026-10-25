import type { Migration } from '../Migration.js';

export const movieFollowMigration: Migration = {
  version: 5,
  name: 'movie-follow',
  up: (db) => {
    db.exec(
      'ALTER TABLE movie ADD COLUMN follow INTEGER NOT NULL DEFAULT 0 CHECK (follow IN (0, 1))',
    );
  },
};
