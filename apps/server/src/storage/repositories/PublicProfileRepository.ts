import type { PublicPage } from '@metrack/domain';

/**
 * Who has a public page and under which handle. Not scoped: the public routes look a user up by handle
 * before any user is in scope. Handles are compared without regard to case.
 */
export interface PublicProfileRepository {
  get(userId: number): Promise<PublicPage>;
  /** The user a handle belongs to, with whether their page is switched on. */
  findByHandle(handle: string): Promise<{ userId: number; enabled: boolean } | undefined>;
  /** Stores the page; throws `HandleTakenError` when another user has the handle. */
  save(userId: number, page: PublicPage): Promise<void>;
}
