import type { ApiToken } from '@metrack/domain';
import type { NewApiToken } from './NewApiToken.js';
import type { StoredApiToken } from './StoredApiToken.js';

/** Personal API tokens. Not user-scoped: tokens are looked up before anyone is signed in. */
export interface ApiTokenRepository {
  create(token: NewApiToken): Promise<ApiToken>;
  bySecretHash(secretHash: string): Promise<StoredApiToken | undefined>;
  /** The user's tokens, newest first. */
  listForUser(userId: number): Promise<ApiToken[]>;
  /** Deletes one of the user's tokens; false when they have no token with that id. */
  delete(userId: number, id: number): Promise<boolean>;
  markUsed(id: number, at: string): Promise<void>;
}
