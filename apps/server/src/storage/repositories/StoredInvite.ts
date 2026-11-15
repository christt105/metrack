import type { InviteUse } from '@metrack/domain';

/** An invitation row with the people who used it, oldest first. */
export interface StoredInvite {
  id: number;
  maxUses: number;
  uses: number;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  usedBy: InviteUse[];
}
