import type { IncomingHttpHeaders } from 'node:http';
import type { User } from '@metrack/domain';

/** Tells who is making a request, from its headers. */
export interface Authenticator {
  userFor(headers: IncomingHttpHeaders): Promise<User | undefined>;
}
