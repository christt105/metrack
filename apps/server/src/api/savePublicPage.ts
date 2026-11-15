import type { PublicPage } from '@metrack/domain';
import { HandleTakenError } from '../storage/HandleTakenError.js';
import type { PublicProfileRepository } from '../storage/repositories/PublicProfileRepository.js';
import { ApiError } from './ApiError.js';

/** Stores a user's public page; throws a 409 when another user has its handle. */
export async function savePublicPage(
  profiles: PublicProfileRepository,
  userId: number,
  page: PublicPage,
): Promise<void> {
  const owner = page.handle === null ? undefined : await profiles.findByHandle(page.handle);
  if (owner && owner.userId !== userId) {
    throw ApiError.conflict('handle_taken', 'Another user already has that handle');
  }
  try {
    await profiles.save(userId, page);
  } catch (error) {
    if (error instanceof HandleTakenError) {
      throw ApiError.conflict('handle_taken', 'Another user already has that handle');
    }
    throw error;
  }
}
