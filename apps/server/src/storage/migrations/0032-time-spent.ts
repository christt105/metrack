import type { Migration } from '../Migration.js';

export const timeSpentMigration: Migration = {
  version: 32,
  name: 'time-spent',
  up: (db) => {
    db.exec(`
      ALTER TABLE videogame_entry ADD COLUMN time_spent_minutes INTEGER CHECK (time_spent_minutes IS NULL OR time_spent_minutes >= 0);
      ALTER TABLE book_entry ADD COLUMN time_spent_minutes INTEGER CHECK (time_spent_minutes IS NULL OR time_spent_minutes >= 0);
      ALTER TABLE movie ADD COLUMN runtime INTEGER CHECK (runtime IS NULL OR runtime >= 0);
      ALTER TABLE series ADD COLUMN episode_runtime INTEGER CHECK (episode_runtime IS NULL OR episode_runtime >= 0);
      CREATE INDEX movie_runtime_missing ON movie (id) WHERE runtime IS NULL AND tmdb_id IS NOT NULL;
    `);
  },
};
