import type { Migration } from '../Migration.js';

/**
 * The status and dates a season entry held before its episodes first had a viewing, as JSON, so that removing the
 * last viewing puts them back. Null while the entry is not derived from episodes or was never remembered.
 */
export const manualTrackingMigration: Migration = {
  version: 40,
  name: 'manual-tracking',
  up: (db) => {
    db.exec('ALTER TABLE season_entry ADD COLUMN manual_tracking TEXT');
  },
};
