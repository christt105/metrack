import type { MediaEntityRepository } from '../storage/repositories/MediaEntityRepository.js';
import type { MediaRepository } from './MediaRepository.js';

export function asMediaRepository<T extends { id: number }>(
  repository: MediaEntityRepository<T>,
): MediaRepository {
  return repository as unknown as MediaRepository;
}
