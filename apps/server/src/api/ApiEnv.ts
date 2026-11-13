import type { TokenScope, User } from '@metrack/domain';

/** The Hono environment of the API: the guard stores who made the request and, for a token, its scope. */
export interface ApiEnv {
  Variables: { user: User | null; tokenScope: TokenScope | null };
}
