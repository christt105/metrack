import type { EntityRepository } from '../storage/repositories/EntityRepository.js';
import type { MediaRepository } from './MediaRepository.js';

export function asMediaRepository<T extends { id: number }>(
  repository: EntityRepository<T>,
): MediaRepository {
  return repository as unknown as MediaRepository;
}
