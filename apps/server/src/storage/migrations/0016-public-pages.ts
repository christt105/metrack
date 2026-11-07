import type { Migration } from '../Migration.js';

/**
 * Lets a user serve a public page of their library. The handle is the name the page lives under: unique
 * whatever the case, and empty until the user picks one. `public_page` switches the page on and starts off.
 */
export const publicPagesMigration: Migration = {
  version: 16,
  name: 'public-pages',
  up: (db) => {
    db.exec(`
      ALTER TABLE user ADD COLUMN handle TEXT;

      CREATE UNIQUE INDEX user_handle ON user (handle COLLATE NOCASE) WHERE handle IS NOT NULL;

      ALTER TABLE user_setting ADD COLUMN public_page INTEGER NOT NULL DEFAULT 0;
    `);
  },
};
