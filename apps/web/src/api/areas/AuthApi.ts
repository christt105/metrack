import type { InvitePreview, WelcomeRequest, HealthReport, User } from '@metrack/domain';
import { ApiRequestError } from '../ApiRequestError';
import type { HttpTransport } from '../HttpTransport';

export class AuthApi {
  constructor(private readonly transport: HttpTransport) {}

  /** The signed-in user, or null without a session. */
  async me(): Promise<User | null> {
    try {
      return await this.transport.request<User>('GET', '/auth/me');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) return null;
      throw error;
    }
  }

  /** Who can sign in with dev login, or null when the server does not offer it. */
  async devUsers(): Promise<User[] | null> {
    try {
      return await this.transport.request<User[]>('GET', '/auth/dev-users');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  }

  devLogin(userId: number): Promise<User> {
    return this.transport.request('POST', '/auth/dev-login', { userId });
  }

  tokenLogin(token: string): Promise<User> {
    return this.transport.request('POST', '/auth/token-login', { token });
  }

  logout(): Promise<void> {
    return this.transport.request('POST', '/auth/logout');
  }

  /** A degraded service answers 503 with the same report, which is returned rather than thrown. */
  health(): Promise<HealthReport> {
    return this.transport.request('GET', '/health', undefined, [503]);
  }

  /** Public: whether an invitation link works and who invites. Spends nothing. */
  invitePreview(code: string): Promise<InvitePreview> {
    return this.transport.request('GET', `/invites/${encodeURIComponent(code)}`);
  }

  completeWelcome(request: WelcomeRequest): Promise<User> {
    return this.transport.request('POST', '/account/welcome', request);
  }
}
