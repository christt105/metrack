import type { InviteStatus } from './InviteStatus.js';
import type { InviteUse } from './InviteUse.js';

/** An invitation as the owner sees it. The code itself is only shown when the invitation is created. */
export interface Invite {
  id: number;
  maxUses: number;
  uses: number;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  status: InviteStatus;
  usedBy: InviteUse[];
}
