import { sessionFromRow } from '../mapping/sessionFromRow.js';
import type { SessionRepository } from '../repositories/SessionRepository.js';
import type { StoredSession } from '../repositories/StoredSession.js';
import type { D1Database } from './D1Database.js';
import { execute, queryFirst } from './d1Query.js';

export class D1SessionRepository implements SessionRepository {
  constructor(private readonly db: D1Database) {}

  async create(session: StoredSession): Promise<void> {
    await execute(
      this.db,
      'INSERT INTO session (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      session.id,
      session.userId,
      session.createdAt,
      session.expiresAt,
    );
  }

  async get(id: string): Promise<StoredSession | undefined> {
    const row = await queryFirst(this.db, 'SELECT * FROM session WHERE id = ?', id);
    return row ? sessionFromRow(row) : undefined;
  }

  async delete(id: string): Promise<void> {
    await execute(this.db, 'DELETE FROM session WHERE id = ?', id);
  }

  /** Scans every session for the expired ones; run it from a scheduled job, never per request. */
  async deleteExpired(now: string): Promise<void> {
    await execute(this.db, 'DELETE FROM session WHERE expires_at <= ?', now);
  }
}
