import type { InviteStatus } from '@metrack/domain';
import type { StoredInvite } from '../storage/repositories/StoredInvite.js';

/** Whether an invitation can be used at the given moment, and if not, why. A revoked one stays revoked whatever else is true. */
export function inviteStatus(invite: StoredInvite, now: Date): InviteStatus {
  if (invite.revokedAt !== null) return 'revoked';
  if (invite.uses >= invite.maxUses) return 'used_up';
  return invite.expiresAt <= now.toISOString() ? 'expired' : 'valid';
}
