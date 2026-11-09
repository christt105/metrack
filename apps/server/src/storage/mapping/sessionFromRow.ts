import type { StoredSession } from '../repositories/StoredSession.js';
import type { Row } from './Row.js';

export function sessionFromRow(row: Row): StoredSession {
  return {
    id: String(row.id),
    userId: Number(row.user_id),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
  };
}
