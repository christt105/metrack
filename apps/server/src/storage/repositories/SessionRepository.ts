import type { StoredSession } from './StoredSession.js';

export interface SessionRepository {
  create(session: StoredSession): Promise<void>;
  get(id: string): Promise<StoredSession | undefined>;
  delete(id: string): Promise<void>;
  /** Removes the sessions that expired at or before the instant (an ISO timestamp). */
  deleteExpired(now: string): Promise<void>;
}
