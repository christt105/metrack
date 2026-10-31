import type { Migration } from '../Migration.js';

export const pendingReviewMigration: Migration = {
  version: 8,
  name: 'pending-review',
  up: (db) => {
    for (const table of ['movie', 'season', 'videogame', 'book']) {
      db.exec(
        `ALTER TABLE ${table} ADD COLUMN pending_review INTEGER NOT NULL DEFAULT 0 CHECK (pending_review IN (0, 1))`,
      );
    }
  },
};
