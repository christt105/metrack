import type { DatabaseSync } from 'node:sqlite';
import type { ApiToken, TokenScope } from '@metrack/domain';
import type { ApiTokenRepository } from '../repositories/ApiTokenRepository.js';
import type { NewApiToken } from '../repositories/NewApiToken.js';
import type { StoredApiToken } from '../repositories/StoredApiToken.js';
import type { Row } from './Row.js';

export class SqliteApiTokenRepository implements ApiTokenRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(token: NewApiToken): Promise<ApiToken> {
    const result = this.db
      .prepare(
        `INSERT INTO api_token (user_id, name, secret_hash, scope, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        token.userId,
        token.name,
        token.secretHash,
        token.scope,
        token.createdAt,
        token.expiresAt,
      );
    return {
      id: Number(result.lastInsertRowid),
      name: token.name,
      scope: token.scope,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsedAt: null,
    };
  }

  async bySecretHash(secretHash: string): Promise<StoredApiToken | undefined> {
    const row = this.db.prepare('SELECT * FROM api_token WHERE secret_hash = ?').get(secretHash);
    if (!row) return undefined;
    return { ...toToken(row), userId: Number(row.user_id), secretHash: String(row.secret_hash) };
  }

  async listForUser(userId: number): Promise<ApiToken[]> {
    return this.db
      .prepare('SELECT * FROM api_token WHERE user_id = ? ORDER BY created_at DESC, id DESC')
      .all(userId)
      .map(toToken);
  }

  async delete(userId: number, id: number): Promise<boolean> {
    const result = this.db
      .prepare('DELETE FROM api_token WHERE user_id = ? AND id = ?')
      .run(userId, id);
    return Number(result.changes) > 0;
  }

  async markUsed(id: number, at: string): Promise<void> {
    this.db.prepare('UPDATE api_token SET last_used_at = ? WHERE id = ?').run(at, id);
  }
}

function toToken(row: Row): ApiToken {
  return {
    id: Number(row.id),
    name: String(row.name),
    scope: String(row.scope) as TokenScope,
    createdAt: String(row.created_at),
    expiresAt: row.expires_at === null ? null : String(row.expires_at),
    lastUsedAt: row.last_used_at === null ? null : String(row.last_used_at),
  };
}
