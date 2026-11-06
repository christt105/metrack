import type { Migration } from '../Migration.js';

/**
 * Adds users and their sign-in sessions. User 1 is created as the owner of everything stored so far;
 * a session row keeps only the SHA-256 of its token, so the table alone cannot be used to sign in.
 */
export const usersMigration: Migration = {
  version: 10,
  name: 'users',
  up: (db) => {
    db.exec(`
      CREATE TABLE user (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE COLLATE NOCASE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE session (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX session_user ON session (user_id);
      INSERT INTO user (id, name, email, created_at)
      VALUES (1, 'Owner', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
    `);
  },
};
