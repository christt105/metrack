import type { TokenScope } from './TokenScope.js';

export interface CreateTokenRequest {
  name: string;
  scope: TokenScope;
  /** One of `TOKEN_LIFETIMES_DAYS`; `null` never expires. */
  expiresInDays: number | null;
}
