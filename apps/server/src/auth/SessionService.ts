import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@metrack/domain';
import type { SessionRepository } from '../storage/repositories/SessionRepository.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import type { StartedSession } from './StartedSession.js';

export const SESSION_TTL_MS = 30 * 24 * 3_600_000;

/**
 * Starts, resolves and ends sign-in sessions. The browser keeps a random token; only its SHA-256 is
 * stored, so reading the database is not enough to impersonate anyone.
 */
export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly ttlMs = SESSION_TTL_MS,
  ) {}

  async start(userId: number): Promise<StartedSession> {
    const now = this.now();
    await this.sessions.deleteExpired(now.toISOString());
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    await this.sessions.create({
      id: hashToken(token),
      userId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    return { token, expiresAt };
  }

  /** The user a token signs in, or undefined when it is unknown or expired. */
  async resolve(token: string): Promise<User | undefined> {
    const session = await this.sessions.get(hashToken(token));
    if (!session || session.expiresAt <= this.now().toISOString()) return undefined;
    return this.users.get(session.userId);
  }

  async end(token: string): Promise<void> {
    await this.sessions.delete(hashToken(token));
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
