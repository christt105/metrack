import type { InviteUse } from '@metrack/domain';
import type { StoredInvite } from '../repositories/StoredInvite.js';
import type { Row } from './Row.js';
import { text } from './rowMapping.js';

/** Builds an invitation from its row and the rows of the people who used it. */
export function inviteFromRows(row: Row, uses: Row[]): StoredInvite {
  return {
    id: Number(row.id),
    maxUses: Number(row.max_uses),
    uses: Number(row.uses),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    revokedAt: text(row.revoked_at),
    usedBy: uses.map((use): InviteUse => ({
      userId: use.user_id === null ? null : Number(use.user_id),
      userName: text(use.user_name),
      usedAt: String(use.used_at),
    })),
  };
}

export const INVITE_USES_SQL = `SELECT u.invite_id, u.user_id, u.used_at, x.name AS user_name
  FROM invite_use u LEFT JOIN user x ON x.id = u.user_id`;
