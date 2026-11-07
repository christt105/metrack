import type { Migration } from '../Migration.js';

/**
 * Adds what each user's background jobs need: the Jellyfin account whose viewings are synced, the ntfy topic
 * their alerts go to, the Cloudflare Pages project their site is published to and the vault folder their notes
 * are mirrored into. A job runs only for users who set its column. No row is created here: the server fills
 * user 1's from the environment the first time it starts.
 */
export const userSettingsMigration: Migration = {
  version: 12,
  name: 'user-settings',
  up: (db) => {
    db.exec(`
      CREATE TABLE user_setting (
        user_id INTEGER PRIMARY KEY REFERENCES user (id) ON DELETE CASCADE,
        jellyfin_user TEXT,
        ntfy_topic TEXT,
        publish_project TEXT,
        publish_base_url TEXT,
        mirror_dir TEXT,
        mirror_link_prefix TEXT
      );
    `);
  },
};
