import type { Migration } from '../Migration.js';

/**
 * Adds personal API tokens. Like sessions, a row keeps only the SHA-256 of the secret, so the table
 * alone cannot be used to call the API.
 */
export const apiTokensMigration: Migration = {
  version: 13,
  name: 'api-tokens',
  up: (db) => {
    db.exec(`
      CREATE TABLE api_token (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        secret_hash TEXT NOT NULL UNIQUE,
        scope TEXT NOT NULL CHECK (scope IN ('read', 'write')),
        created_at TEXT NOT NULL,
        expires_at TEXT,
        last_used_at TEXT
      );
      CREATE INDEX api_token_user ON api_token (user_id);
    `);
  },
};
