import type { Migration } from '../Migration.js';

/**
 * Per library entry, what Steam says about the achievements of a game: how many the user unlocked, how many the game
 * has, the date of the last unlock and when the check last ran. A null `achievements_total` means unknown (never
 * fetched, or every fetch failed), 0 means the game has none.
 */
export const steamAchievementsMigration: Migration = {
  version: 36,
  name: 'steam-achievements',
  up: (db) => {
    db.exec(`
      ALTER TABLE videogame_entry ADD COLUMN achievements_unlocked INTEGER CHECK (achievements_unlocked IS NULL OR achievements_unlocked >= 0);
      ALTER TABLE videogame_entry ADD COLUMN achievements_total INTEGER CHECK (achievements_total IS NULL OR achievements_total >= 0);
      ALTER TABLE videogame_entry ADD COLUMN achievements_last_unlocked_at TEXT;
      ALTER TABLE videogame_entry ADD COLUMN achievements_checked_at TEXT;
    `);
  },
};
