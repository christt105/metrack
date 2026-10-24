import type { Migration } from '../Migration.js';

export const imagesMigration: Migration = {
  version: 3,
  name: 'images',
  up: (db) => {
    db.exec(`
      CREATE TABLE image (
        hash TEXT PRIMARY KEY,
        extension TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        byte_size INTEGER NOT NULL,
        source_url TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX image_source_url ON image (source_url);
    `);
  },
};
