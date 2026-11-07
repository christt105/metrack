import type { User } from '@metrack/domain';
import { ApiError } from './ApiError.js';

/** The user the auth guard signed in, for routes that are never public. */
export function requireUser(user: User | null): User {
  if (user === null) throw new ApiError(401, 'unauthenticated', 'Sign in first');
  return user;
}
