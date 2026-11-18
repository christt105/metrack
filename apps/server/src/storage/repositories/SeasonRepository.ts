import type { Season } from '@metrack/domain';
import type { MediaEntityRepository } from './MediaEntityRepository.js';

export interface SeasonRepository extends MediaEntityRepository<Season> {
  /** Seasons of one series ordered by number. */
  listBySeries(seriesId: number): Promise<Season[]>;
  /**
   * Clears the provider season number of every season of the series, including the ones only other users
   * have, so each one is linked again on its next refresh.
   */
  unlinkProviderSeasons(seriesId: number): Promise<void>;
  /**
   * Whether any user's entry for the season holds something they entered: a status other than planned, a rating,
   * a review, rewatches, dates, tags or hand edits. Not scoped.
   */
  hasPersonalData(seasonId: number): Promise<boolean>;
  /** Deletes the season for every user, with their entries and its episode catalog. Not scoped. */
  deleteForAll(seasonId: number): Promise<void>;
}
