import type { ApiToken } from '@metrack/domain';
import { tokenFromRow } from '../mapping/tokenFromRow.js';
import type { ApiTokenRepository } from '../repositories/ApiTokenRepository.js';
import type { NewApiToken } from '../repositories/NewApiToken.js';
import type { StoredApiToken } from '../repositories/StoredApiToken.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll, queryFirst } from './d1Query.js';

export class D1ApiTokenRepository implements ApiTokenRepository {
  constructor(private readonly db: D1Database) {}

  async create(token: NewApiToken): Promise<ApiToken> {
    const meta = await execute(
      this.db,
      `INSERT INTO api_token (user_id, name, secret_hash, scope, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      token.userId,
      token.name,
      token.secretHash,
      token.scope,
      token.createdAt,
      token.expiresAt,
    );
    return {
      id: meta.last_row_id,
      name: token.name,
      scope: token.scope,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsedAt: null,
    };
  }

  async bySecretHash(secretHash: string): Promise<StoredApiToken | undefined> {
    const row = await queryFirst(
      this.db,
      'SELECT * FROM api_token WHERE secret_hash = ?',
      secretHash,
    );
    if (!row) return undefined;
    return {
      ...tokenFromRow(row),
      userId: Number(row.user_id),
      secretHash: String(row.secret_hash),
    };
  }

  async listForUser(userId: number): Promise<ApiToken[]> {
    const rows = await queryAll(
      this.db,
      'SELECT * FROM api_token WHERE user_id = ? ORDER BY created_at DESC, id DESC',
      userId,
    );
    return rows.map(tokenFromRow);
  }

  async delete(userId: number, id: number): Promise<boolean> {
    const meta = await execute(
      this.db,
      'DELETE FROM api_token WHERE user_id = ? AND id = ?',
      userId,
      id,
    );
    return meta.changes > 0;
  }

  async markUsed(id: number, at: string): Promise<void> {
    await execute(this.db, 'UPDATE api_token SET last_used_at = ? WHERE id = ?', at, id);
  }
}
