import type { Movie } from '@metrack/domain';
import type { EntityRepository } from './EntityRepository.js';

export interface MovieRepository extends EntityRepository<Movie> {
  findByTmdbId(tmdbId: number): Promise<Movie | undefined>;
  listFollowed(): Promise<Movie[]>;
}
