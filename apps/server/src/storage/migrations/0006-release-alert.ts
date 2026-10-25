import type { Migration } from '../Migration.js';

export const releaseAlertMigration: Migration = {
  version: 6,
  name: 'release-alert',
  up: (db) => {
    db.exec(`
      CREATE TABLE release_alert (
        id INTEGER PRIMARY KEY,
        subject_type TEXT NOT NULL CHECK (subject_type IN ('movie', 'season')),
        subject_id INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('releases_tomorrow', 'releases_today', 'available_es')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        UNIQUE (subject_type, subject_id, kind)
      );
    `);
  },
};
