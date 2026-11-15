import type { User } from '@metrack/domain';
import type { InviteRedemption } from './InviteRedemption.js';
import type { NewInvite } from './NewInvite.js';
import type { StoredInvite } from './StoredInvite.js';

/** Invitation links. Not user-scoped: they are looked up before anyone is signed in. */
export interface InviteRepository {
  create(invite: NewInvite): Promise<StoredInvite>;
  /** Every invitation, newest first. */
  list(): Promise<StoredInvite[]>;
  byCodeHash(codeHash: string): Promise<StoredInvite | undefined>;
  /** Revokes an invitation that is not revoked and still has uses left; false when it was not. */
  revoke(id: number, at: string): Promise<boolean>;
  /**
   * Creates the user and spends one use, both or neither: the use is taken only while the invitation is not
   * revoked or expired and has uses left, and the user and the use record are written only if it was taken. Two
   * calls racing for the last use create exactly one user. Answers the new user, or undefined when the
   * invitation could not be used. Throws when the email or the Google account already belongs to a user.
   */
  redeem(redemption: InviteRedemption): Promise<User | undefined>;
}
