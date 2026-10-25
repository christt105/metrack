import type { Migration } from '../Migration.js';

export const imageSourceMigration: Migration = {
  version: 7,
  name: 'image-source',
  up: (db) => {
    db.exec(`
      CREATE TABLE image_source (
        url TEXT PRIMARY KEY,
        hash TEXT NOT NULL REFERENCES image (hash) ON DELETE CASCADE
      );

      CREATE INDEX image_source_hash ON image_source (hash);
    `);
  },
};
