import type { User } from '@metrack/domain';
import type { Authenticator } from '../../src/auth/Authenticator.js';

export const OWNER: User = { id: 1, name: 'Owner', email: null, role: 'owner' };

/** Treats every request as coming from the user, so route tests need no session. */
export function signedInAs(user: User = OWNER): Authenticator {
  return { userFor: async () => user };
}
