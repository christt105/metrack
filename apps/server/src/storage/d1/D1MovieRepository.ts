import type { Movie } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { movieTable } from '../mapping/movieTable.js';
import type { MovieRepository } from '../repositories/MovieRepository.js';
import type { D1Database } from './D1Database.js';
import { D1TableRepository } from './D1TableRepository.js';

export class D1MovieRepository extends D1TableRepository<Movie> implements MovieRepository {
  constructor(db: D1Database, scope: UserScope) {
    super(db, scope, movieTable);
  }

  async findByTmdbId(tmdbId: number): Promise<Movie | undefined> {
    return this.findOneBy('tmdb_id', tmdbId);
  }

  async listFollowed(): Promise<Movie[]> {
    return this.where('e.follow = 1 ORDER BY c.id');
  }
}
