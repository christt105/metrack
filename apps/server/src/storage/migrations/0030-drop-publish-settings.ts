import type { Migration } from '../Migration.js';

export const dropPublishSettingsMigration: Migration = {
  version: 30,
  name: 'drop-publish-settings',
  up: (db) => {
    db.exec(`
      ALTER TABLE user_setting DROP COLUMN publish_project;
      ALTER TABLE user_setting DROP COLUMN publish_base_url;
    `);
  },
};
