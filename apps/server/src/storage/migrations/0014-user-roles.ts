import type { Migration } from '../Migration.js';

const OWNABLE: { table: string; keys: string[] }[] = [
  { table: 'movie', keys: ['tmdb_id'] },
  { table: 'series', keys: ['tmdb_id', 'tvdb_id'] },
  { table: 'videogame', keys: ['igdb_id'] },
  { table: 'book', keys: ['openlibrary_id'] },
];

/**
 * Adds user roles (user 1 is the owner, everyone else starts normal) and an owner for catalog rows added by
 * hand, the ones without any provider id. Those rows are never shared, so each existing one goes to the user
 * whose entry it has.
 */
export const userRolesMigration: Migration = {
  version: 14,
  name: 'user-roles',
  up: (db) => {
    db.exec(`
      ALTER TABLE user ADD COLUMN role TEXT NOT NULL DEFAULT 'normal'
        CHECK (role IN ('owner', 'trusted', 'normal'));
      UPDATE user SET role = 'owner' WHERE id = 1;
    `);
    for (const { table, keys } of OWNABLE) {
      db.exec(`
        ALTER TABLE ${table} ADD COLUMN owner_id INTEGER REFERENCES user (id) ON DELETE CASCADE;
        UPDATE ${table} SET owner_id = (
          SELECT MIN(user_id) FROM ${table}_entry WHERE ${table}_id = ${table}.id
        ) WHERE ${keys.map((key) => `${key} IS NULL`).join(' AND ')};
      `);
    }
  },
};
