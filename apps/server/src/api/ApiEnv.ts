import type { User } from '@metrack/domain';

/** The Hono environment of the API: the guard stores who made the request. */
export interface ApiEnv {
  Variables: { user: User | null };
}
