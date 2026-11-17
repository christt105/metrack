import type { Migration } from '../Migration.js';

const TABLES = ['movie_entry', 'season_entry', 'videogame_entry', 'book_entry'];

/** Turns each rewatch date into a viewing without a start: `rewatches` becomes a JSON list of viewings. */
export const rewatchViewingsMigration: Migration = {
  version: 25,
  name: 'rewatch-viewings',
  up: (db) => {
    for (const table of TABLES) {
      db.exec(`
        UPDATE ${table} SET rewatches = (
          SELECT json_group_array(json_object('startedAt', NULL, 'finishedAt', value))
          FROM (SELECT value FROM json_each(${table}.rewatches) ORDER BY value)
        ) WHERE rewatches <> '[]' AND json_type(rewatches, '$[0]') = 'text';
      `);
    }
  },
};
