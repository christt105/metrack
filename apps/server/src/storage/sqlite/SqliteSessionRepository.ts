import type { DatabaseSync } from 'node:sqlite';
import type { SessionRepository } from '../repositories/SessionRepository.js';
import type { StoredSession } from '../repositories/StoredSession.js';

export class SqliteSessionRepository implements SessionRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(session: StoredSession): Promise<void> {
    this.db
      .prepare('INSERT INTO session (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(session.id, session.userId, session.createdAt, session.expiresAt);
  }

  async get(id: string): Promise<StoredSession | undefined> {
    const row = this.db.prepare('SELECT * FROM session WHERE id = ?').get(id);
    if (!row) return undefined;
    return {
      id: String(row.id),
      userId: Number(row.user_id),
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
    };
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM session WHERE id = ?').run(id);
  }

  async deleteExpired(now: string): Promise<void> {
    this.db.prepare('DELETE FROM session WHERE expires_at <= ?').run(now);
  }
}
