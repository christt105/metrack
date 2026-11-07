import type { UserRole } from './api/UserRole.js';

/** Whether a role may add items by hand, the ones no provider knows (fangames and the like). */
export function canAddByHand(role: UserRole): boolean {
  return role !== 'normal';
}
