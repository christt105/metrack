import type { Movie } from '@metrack/domain';
import type { MediaEntityRepository } from './MediaEntityRepository.js';

export interface MovieRepository extends MediaEntityRepository<Movie> {
  findByTmdbId(tmdbId: number): Promise<Movie | undefined>;
  listFollowed(): Promise<Movie[]>;
}
