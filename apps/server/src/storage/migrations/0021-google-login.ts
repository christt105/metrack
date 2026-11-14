import type { Migration } from '../Migration.js';

/** Lets a user be linked to one Google account, by its `sub`, to sign in with it. */
export const googleLoginMigration: Migration = {
  version: 21,
  name: 'google-login',
  up: (db) => {
    db.exec(`
      ALTER TABLE user ADD COLUMN google_sub TEXT;
      CREATE UNIQUE INDEX user_google_sub ON user (google_sub);
    `);
  },
};
