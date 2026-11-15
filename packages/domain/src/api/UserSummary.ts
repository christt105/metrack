import type { AccountDeletion } from './AccountDeletion.js';
import type { UserRole } from './UserRole.js';

/** One account in the owner's users panel. `deletion` is the scheduled deletion waiting for it, if any. */
export interface UserSummary {
  id: number;
  name: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
  usedBytes: number;
  deletion: AccountDeletion | null;
}
