import type { Migration } from '../Migration.js';

/**
 * Whether the user asked to watch a season again. It is a fact of the season entry that its episodes cannot
 * reproduce, and with it a half-watched later pass counts as a rewatch of the season.
 */
export const rewatchIntentMigration: Migration = {
  version: 39,
  name: 'rewatch-intent',
  up: (db) => {
    db.exec(
      'ALTER TABLE season_entry ADD COLUMN wants_rewatch INTEGER NOT NULL DEFAULT 0 CHECK (wants_rewatch IN (0,1))',
    );
  },
};
