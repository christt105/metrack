import type { Migration } from '../Migration.js';

/**
 * Invitation links and who joined through them. An invitation keeps only the SHA-256 of its code, a limit of
 * uses, an expiry and a revocation time; each use records the user it created. `user.onboarded_at` is null for
 * a user who joined by invitation until they confirm their name and handle, and set for every existing user.
 */
export const invitesMigration: Migration = {
  version: 22,
  name: 'invites',
  up: (db) => {
    db.exec(`
      CREATE TABLE invite (
        id INTEGER PRIMARY KEY,
        code_hash TEXT NOT NULL UNIQUE,
        max_uses INTEGER NOT NULL CHECK (max_uses >= 1),
        uses INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE TABLE invite_use (
        id INTEGER PRIMARY KEY,
        invite_id INTEGER NOT NULL REFERENCES invite (id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES user (id) ON DELETE SET NULL,
        used_at TEXT NOT NULL
      );

      CREATE INDEX invite_use_invite ON invite_use (invite_id);
      CREATE INDEX invite_use_user ON invite_use (user_id);

      ALTER TABLE user ADD COLUMN onboarded_at TEXT;
      UPDATE user SET onboarded_at = created_at;
    `);
  },
};
