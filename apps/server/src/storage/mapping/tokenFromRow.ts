import type { ApiToken, TokenScope } from '@metrack/domain';
import type { Row } from './Row.js';

export function tokenFromRow(row: Row): ApiToken {
  return {
    id: Number(row.id),
    name: String(row.name),
    scope: String(row.scope) as TokenScope,
    createdAt: String(row.created_at),
    expiresAt: row.expires_at === null ? null : String(row.expires_at),
    lastUsedAt: row.last_used_at === null ? null : String(row.last_used_at),
  };
}
