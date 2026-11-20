import type { InviteStatus } from './InviteStatus.js';

/** What the public invitation page shows: whether the link works and the name of the owner who invites (empty for an unknown link). */
export interface InvitePreview {
  status: InviteStatus;
  inviter: string;
}
