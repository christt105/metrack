import type { Migration } from '../Migration.js';

export const userLanguageMigration: Migration = {
  version: 31,
  name: 'user-language',
  up: (db) => {
    db.exec(`ALTER TABLE user_setting ADD COLUMN language TEXT CHECK (language IN ('es', 'en'));`);
  },
};
