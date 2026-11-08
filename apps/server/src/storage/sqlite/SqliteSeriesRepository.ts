import type { DatabaseSync } from 'node:sqlite';
import type { Series } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { seriesTable } from '../mapping/seriesTable.js';
import type { SeriesRepository } from '../repositories/SeriesRepository.js';
import { SqliteTableRepository } from './SqliteTableRepository.js';

export class SqliteSeriesRepository
  extends SqliteTableRepository<Series>
  implements SeriesRepository
{
  constructor(db: DatabaseSync, scope: UserScope) {
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
