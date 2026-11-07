import type { TokenScope, User } from '@metrack/domain';

/** Who a personal API token signs in, and what it may do. */
export interface TokenSignIn {
  user: User;
  scope: TokenScope;
}
