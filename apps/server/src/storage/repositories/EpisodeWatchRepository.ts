import type { EpisodeWatches, SeasonEntryUpdate, UnmatchedEpisode } from '@metrack/domain';
import type { StoredEpisodeWatches } from './StoredEpisodeWatches.js';

/** What users watched of each series, keyed by episode, one row per series and user. */
export interface EpisodeWatchRepository {
  /** The watches of the user in scope for the series, or undefined when the user has no row for it. */
  get(seriesId: number): Promise<EpisodeWatches | undefined>;
  /** The whole row of the user in scope for the series, in one read. */
  getEntry(seriesId: number): Promise<StoredEpisodeWatches | undefined>;
  /** Every row of the user in scope, ordered by series. */
  list(): Promise<StoredEpisodeWatches[]>;
  /** The keys of the episodes the user in scope skipped of the series. */
  getSkipped(seriesId: number): Promise<string[]>;
  /**
   * Stores the watches of the user in scope, and the skipped keys when given (kept as they were otherwise).
   * `seasons` are the season entries of the series that change with them (`watched_count`, `skipped_count`, and
   * the status, dates and rewatches), written in the same atomic step. `activityAt`, a full ISO timestamp, is
   * stored as the time of the last change to the series' episodes; left out, the stored one is kept.
   */
  set(
    seriesId: number,
    watched: EpisodeWatches,
    seasons?: readonly SeasonEntryUpdate[],
    skipped?: readonly string[],
    activityAt?: string,
  ): Promise<void>;
  /** Replaces the unmatched episodes of the user in scope for the series, creating the row when it has none. */
  setUnmatched(seriesId: number, unmatched: readonly UnmatchedEpisode[]): Promise<void>;
  /** The rows of every user for the series; not scoped. */
  listForSeries(seriesId: number): Promise<StoredEpisodeWatches[]>;
  /** Like `set`, for a given user; not scoped. */
  replace(
    userId: number,
    seriesId: number,
    watched: EpisodeWatches,
    seasons?: readonly SeasonEntryUpdate[],
    skipped?: readonly string[],
    activityAt?: string,
  ): Promise<void>;
}
