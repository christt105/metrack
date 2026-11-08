import type { Migration } from '../Migration.js';

/**
 * Lets a user ask for their account to be deleted. `deletion_requested_at` holds the moment they asked; the
 * account is erased once the grace period after it has passed, and clearing the column cancels the request.
 */
export const accountDeletionMigration: Migration = {
  version: 18,
  name: 'account-deletion',
  up: (db) => {
    db.exec('ALTER TABLE user ADD COLUMN deletion_requested_at TEXT');
  },
};
