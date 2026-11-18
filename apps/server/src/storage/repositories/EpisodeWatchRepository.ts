import type { EpisodeWatches, SeasonTracking } from '@metrack/domain';
import type { StoredEpisodeWatches } from './StoredEpisodeWatches.js';

/** What users watched of each season, one row per season and user. */
export interface EpisodeWatchRepository {
  /** The watches of the user in scope for the season, or undefined when the user has no row for it. */
  get(seasonId: number): Promise<EpisodeWatches | undefined>;
  /** Every row of the user in scope, ordered by season. */
  list(): Promise<StoredEpisodeWatches[]>;
  /**
   * Stores the watches of the user in scope and keeps the `watchedCount` of their season entry in step. With
   * `tracking`, the season entry's status, dates and rewatches are written in the same atomic step.
   */
  set(seasonId: number, watched: EpisodeWatches, tracking?: SeasonTracking): Promise<void>;
  /** The rows of every user for the season; not scoped. */
  listForSeason(seasonId: number): Promise<StoredEpisodeWatches[]>;
  /** Like `set`, for a given user; not scoped. */
  replace(
    userId: number,
    seasonId: number,
    watched: EpisodeWatches,
    tracking?: SeasonTracking,
  ): Promise<void>;
}
