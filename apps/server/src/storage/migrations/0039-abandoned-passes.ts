import type { Migration } from '../Migration.js';

/** The passes of a season the user abandoned to start over, as a JSON list of `{ startedAt, finishedAt, restartedOn }`. */
export const abandonedPassesMigration: Migration = {
  version: 39,
  name: 'abandoned-passes',
  up: (db) => {
    db.exec("ALTER TABLE season_entry ADD COLUMN abandoned TEXT NOT NULL DEFAULT '[]'");
  },
};
