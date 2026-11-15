import type { Invite } from './Invite.js';

/** A new invitation with its code, which is shown once: only a hash of it is stored. */
export interface CreatedInvite {
  invite: Invite;
  code: string;
}
