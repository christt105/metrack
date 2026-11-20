import type { Migration } from '../Migration.js';

export const steamIdMigration: Migration = {
  version: 33,
  name: 'steam-id',
  up: (db) => {
    db.exec(`
      ALTER TABLE user_setting ADD COLUMN steam_id TEXT CHECK (steam_id IS NULL OR length(steam_id) BETWEEN 1 AND 20);
      CREATE INDEX videogame_steam_linked ON videogame (steam_appid, igdb_id, title) WHERE steam_appid IS NOT NULL AND igdb_id IS NOT NULL;
    `);
  },
};
