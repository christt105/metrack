import type { EpisodeWatches } from '@metrack/domain';
import type { StoredEpisodeWatches } from './StoredEpisodeWatches.js';

/** What users watched of each series, keyed by episode, one row per series and user. */
export interface EpisodeWatchRepository {
  /** The watches of the user in scope for the series, or undefined when the user has no row for it. */
  get(seriesId: number): Promise<EpisodeWatches | undefined>;
  /** Every row of the user in scope, ordered by series. */
  list(): Promise<StoredEpisodeWatches[]>;
  /** Stores the watches of the user in scope. */
  set(seriesId: number, watched: EpisodeWatches): Promise<void>;
  /** The rows of every user for the series; not scoped. */
  listForSeries(seriesId: number): Promise<StoredEpisodeWatches[]>;
  /** Like `set`, for a given user; not scoped. */
  replace(userId: number, seriesId: number, watched: EpisodeWatches): Promise<void>;
}
