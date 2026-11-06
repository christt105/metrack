import type { Series } from '@metrack/domain';
import type { EntityRepository } from './EntityRepository.js';

export interface SeriesRepository extends EntityRepository<Series> {
  findByTmdbId(tmdbId: number): Promise<Series | undefined>;
  findByTvdbId(tvdbId: number): Promise<Series | undefined>;
  listFollowed(): Promise<Series[]>;
}
