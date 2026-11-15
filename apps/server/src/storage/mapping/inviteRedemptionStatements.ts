import type { InviteRedemption } from '../repositories/InviteRedemption.js';
import type { SqlStatement } from './SqlStatement.js';

/**
 * The three statements that redeem an invitation, to run in order inside one transaction (a SQLite
 * transaction at home, a D1 `batch` in the cloud). The first takes a use only while the invitation is valid;
 * the other two run only if it took one, which `changes()` reports for the statement before each of them.
 */
export function inviteRedemptionStatements(redemption: InviteRedemption): SqlStatement[] {
  return [
    {
      sql: `UPDATE invite SET uses = uses + 1
              WHERE code_hash = ? AND revoked_at IS NULL AND expires_at > ? AND uses < max_uses`,
      params: [redemption.codeHash, redemption.at],
    },
    {
      sql: `INSERT INTO user (name, email, created_at, google_sub)
              SELECT ?, ?, ?, ? WHERE changes() > 0`,
      params: [redemption.name, redemption.email, redemption.at, redemption.googleSub],
    },
    {
      sql: `INSERT INTO invite_use (invite_id, user_id, used_at)
              SELECT id, last_insert_rowid(), ? FROM invite WHERE code_hash = ? AND changes() > 0`,
      params: [redemption.at, redemption.codeHash],
    },
  ];
}
