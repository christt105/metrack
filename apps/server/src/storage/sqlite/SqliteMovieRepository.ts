import type { DatabaseSync } from 'node:sqlite';
import type { Movie } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { movieTable } from '../mapping/movieTable.js';
import type { MovieRepository } from '../repositories/MovieRepository.js';
import { SqliteTableRepository } from './SqliteTableRepository.js';

export class SqliteMovieRepository extends SqliteTableRepository<Movie> implements MovieRepository {
  constructor(db: DatabaseSync, scope: UserScope) {
    super(db, scope, movieTable);
  }

  async findByTmdbId(tmdbId: number): Promise<Movie | undefined> {
    return this.findOneBy('tmdb_id', tmdbId);
  }

  async listFollowed(): Promise<Movie[]> {
    return this.where('e.follow = 1 ORDER BY c.id');
  }
}
