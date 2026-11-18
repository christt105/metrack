import type { Episode } from './Episode.js';
import type { EpisodeSource } from './EpisodeSource.js';

/** The shared catalog of one season's episodes, in metrack order. */
export interface SeasonEpisodes {
  seasonId: number;
  episodes: Episode[];
  source: EpisodeSource;
  /** When the catalog was last fetched, as an ISO timestamp. */
  fetchedAt: string;
  /** False while a season too big for one request is still being filled in. */
  complete: boolean;
  /**
   * The episodes fetched so far while a complete catalog that went stale is refetched in chunks; `episodes` keeps
   * being served until the refill is complete. Absent when there is no refill.
   */
  refill?: Episode[];
}
