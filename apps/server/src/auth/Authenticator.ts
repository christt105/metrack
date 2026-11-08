import type { User } from '@metrack/domain';

/** Tells who is making a request, from its headers. */
export interface Authenticator {
  userFor(headers: Headers): Promise<User | undefined>;
}
