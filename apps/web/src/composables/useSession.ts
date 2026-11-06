import { inject } from 'vue';
import type { Session } from '../auth/Session';
import { sessionKey } from '../auth/sessionKey';

/** The session provided by the app root. */
export function useSession(): Session {
  const session = inject(sessionKey);
  if (!session) throw new Error('Session was not provided');
  return session;
}
