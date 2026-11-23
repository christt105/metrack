import type { Migration } from '../Migration.js';

/**
 * The server timestamp at which the user took a series off the next-episode list. The series stays off while it
 * is not older than the last activity of its episodes. Null when the series was never taken off.
 */
export const nextHiddenMigration: Migration = {
  version: 38,
  name: 'next-hidden',
  up: (db) => {
    db.exec('ALTER TABLE series_entry ADD COLUMN next_hidden_at TEXT');
  },
};
