import type { Series } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { seriesTable } from '../mapping/seriesTable.js';
import type { SeriesRepository } from '../repositories/SeriesRepository.js';
import type { D1Database } from './D1Database.js';
import { D1TableRepository } from './D1TableRepository.js';

export class D1SeriesRepository extends D1TableRepository<Series> implements SeriesRepository {
  constructor(db: D1Database, scope: UserScope) {
    super(db, scope, seriesTable);
  }

  async findByTmdbId(tmdbId: number): Promise<Series | undefined> {
    return this.findOneBy('tmdb_id', tmdbId);
  }

  async findByTvdbId(tvdbId: number): Promise<Series | undefined> {
    return this.findOneBy('tvdb_id', tvdbId);
  }

  async listFollowed(): Promise<Series[]> {
    return this.where('e.follow = 1 ORDER BY c.id');
  }
}
