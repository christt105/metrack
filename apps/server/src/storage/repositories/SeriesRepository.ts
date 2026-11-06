import type { Series } from '@metrack/domain';
import type { MediaEntityRepository } from './MediaEntityRepository.js';

export interface SeriesRepository extends MediaEntityRepository<Series> {
  findByTmdbId(tmdbId: number): Promise<Series | undefined>;
  findByTvdbId(tvdbId: number): Promise<Series | undefined>;
  listFollowed(): Promise<Series[]>;
}
