import type { Migration } from '../Migration.js';

/**
 * Lets an API token have the `connector` scope, which the owner's home connector signs in with. SQLite cannot
 * change a CHECK, so the table is rebuilt with its rows and its index.
 */
export const connectorTokenScopeMigration: Migration = {
  version: 20,
  name: 'connector-token-scope',
  up: (db) => {
    db.exec(`
      CREATE TABLE api_token_new (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        secret_hash TEXT NOT NULL UNIQUE,
        scope TEXT NOT NULL CHECK (scope IN ('read', 'write', 'connector')),
        created_at TEXT NOT NULL,
        expires_at TEXT,
        last_used_at TEXT
      );
      INSERT INTO api_token_new SELECT id, user_id, name, secret_hash, scope, created_at, expires_at, last_used_at FROM api_token;
      DROP TABLE api_token;
      ALTER TABLE api_token_new RENAME TO api_token;
      CREATE INDEX api_token_user ON api_token (user_id);
    `);
  },
};
