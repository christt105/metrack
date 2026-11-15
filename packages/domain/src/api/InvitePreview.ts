import type { InviteStatus } from './InviteStatus.js';

/** What the public invitation page shows: whether the link works and the name of the owner who invites. */
export interface InvitePreview {
  status: InviteStatus;
  inviter: string;
}
