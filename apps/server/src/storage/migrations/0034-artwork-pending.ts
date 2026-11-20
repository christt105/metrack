import type { Migration } from '../Migration.js';

export const artworkPendingMigration: Migration = {
  version: 34,
  name: 'artwork-pending',
  up: (db) => {
    db.exec(`
      ALTER TABLE videogame ADD COLUMN artwork_pending INTEGER NOT NULL DEFAULT 0 CHECK (artwork_pending IN (0,1));
      CREATE INDEX videogame_artwork_pending ON videogame (id) WHERE artwork_pending = 1;
    `);
  },
};
