import type { ApiToken } from './ApiToken.js';

/** Answer to creating a token: `secret` goes in `Authorization: Bearer <secret>` and is never shown again. */
export interface CreatedToken {
  token: ApiToken;
  secret: string;
}
