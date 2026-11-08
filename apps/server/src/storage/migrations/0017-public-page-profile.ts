import type { Migration } from '../Migration.js';

/**
 * The header and extras of a public page: an avatar (a stored image reference), an intro, a description,
 * an about text in Markdown and the four values giscus needs. Every column starts empty; comments stay off
 * until all four giscus values are set.
 */
export const publicPageProfileMigration: Migration = {
  version: 17,
  name: 'public-page-profile',
  up: (db) => {
    db.exec(`
      ALTER TABLE user_setting ADD COLUMN public_avatar TEXT;
      ALTER TABLE user_setting ADD COLUMN public_intro TEXT;
      ALTER TABLE user_setting ADD COLUMN public_description TEXT;
      ALTER TABLE user_setting ADD COLUMN public_about TEXT;
      ALTER TABLE user_setting ADD COLUMN giscus_repo TEXT;
      ALTER TABLE user_setting ADD COLUMN giscus_repo_id TEXT;
      ALTER TABLE user_setting ADD COLUMN giscus_category TEXT;
      ALTER TABLE user_setting ADD COLUMN giscus_category_id TEXT;
    `);
  },
};
