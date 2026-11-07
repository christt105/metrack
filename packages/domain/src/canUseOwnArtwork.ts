import type { UserRole } from './api/UserRole.js';

/** Whether a role may set covers and banners of its own (an upload or any URL) instead of provider candidates. */
export function canUseOwnArtwork(role: UserRole): boolean {
  return role !== 'normal';
}
