import type { AccountDeletion } from './AccountDeletion.js';

/** What the signed-in user can do with their account: the deletion waiting for them, if any, and whether they may ask for one. */
export interface AccountStatus {
  deletion: AccountDeletion | null;
  /** False for the owner, whose account cannot be deleted. */
  canDelete: boolean;
}
