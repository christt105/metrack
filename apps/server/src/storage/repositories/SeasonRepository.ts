import type { Season } from '@metrack/domain';
import type { CompletedSeasonEntry } from './CompletedSeasonEntry.js';
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
   * Whether any user's entry for the season holds something the episodes cannot reproduce: a rating, review,
   * tags or hand edits, or a status, dates or rewatches when that user has recorded none of `episodeKeys`.
   * Not scoped.
   */
  hasPersonalData(seasonId: number, episodeKeys: readonly string[]): Promise<boolean>;
  /** The completed entries of every user for the season that have watches of the series. Not scoped. */
  listCompletedEntries(seasonId: number): Promise<CompletedSeasonEntry[]>;
  /** Sets the completed entries of the given users for the season back to in progress, unfinished. Not scoped. */
  reopenEntries(seasonId: number, userIds: readonly number[]): Promise<void>;
  /** Deletes the season for every user, with their entries and its episode catalog. Not scoped. */
  deleteForAll(seasonId: number): Promise<void>;
}
