import type { User } from '@metrack/domain';
import type { Authenticator } from './Authenticator.js';
import { readCookie } from './readCookie.js';
import { SESSION_COOKIE } from './sessionCookie.js';
import type { SessionService } from './SessionService.js';

/** Signs requests in with the session cookie. */
export class SessionCookieAuthenticator implements Authenticator {
  constructor(private readonly sessions: SessionService) {}

  async userFor(headers: Headers): Promise<User | undefined> {
    const token = readCookie(headers.get('cookie') ?? undefined, SESSION_COOKIE);
    return token === undefined ? undefined : this.sessions.resolve(token);
  }
}
