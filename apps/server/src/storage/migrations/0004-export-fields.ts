import type { Migration } from '../Migration.js';

const TABLES = ['movie', 'series', 'season', 'videogame', 'book'];

export const exportFieldsMigration: Migration = {
  version: 4,
  name: 'export-fields',
  up: (db) => {
    for (const table of TABLES) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN slug TEXT`);
      db.exec(`ALTER TABLE ${table} ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
    }
  },
};
