import type { ApiToken } from '@metrack/domain';

/** A personal API token as stored: `secretHash` is the SHA-256 of the secret, never the secret. */
export interface StoredApiToken extends ApiToken {
  userId: number;
  secretHash: string;
}
