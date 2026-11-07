import type { UserRole } from './UserRole.js';

/** The roles the owner can give; `owner` belongs to user 1 only. */
export const ASSIGNABLE_ROLES: readonly UserRole[] = ['trusted', 'normal'];
