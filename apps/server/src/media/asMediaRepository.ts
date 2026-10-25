import type { TableRepository } from '../storage/repositories/TableRepository.js';
import type { MediaRepository } from './MediaRepository.js';

export function asMediaRepository<T extends { id: number }>(
  repository: TableRepository<T>,
): MediaRepository {
  return repository as unknown as MediaRepository;
}
