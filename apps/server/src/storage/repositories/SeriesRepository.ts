import type { Series } from '@metrack/domain';
import type { MediaEntityRepository } from './MediaEntityRepository.js';

export interface SeriesRepository extends MediaEntityRepository<Series> {
  findByTmdbId(tmdbId: number): Promise<Series | undefined>;
  findByTvdbId(tvdbId: number): Promise<Series | undefined>;
  listFollowed(): Promise<Series[]>;
  /** When the user in scope took each series off the next-episode list, by series id; series never taken off are absent. */
  listNextHidden(): Promise<Map<number, string>>;
  /** Stores when the user in scope took the series off the next-episode list, or clears it with null. False when the user has no entry for it. */
  setNextHidden(seriesId: number, at: string | null): Promise<boolean>;
}
