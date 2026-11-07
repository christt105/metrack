import type { TokenScope } from './TokenScope.js';

/** A personal API token as listed to its owner. The secret is only shown once, when it is created. */
export interface ApiToken {
  id: number;
  name: string;
  scope: TokenScope;
  createdAt: string;
  /** `null` when it never expires. */
  expiresAt: string | null;
  lastUsedAt: string | null;
}
