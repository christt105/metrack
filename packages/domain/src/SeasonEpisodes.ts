import type { Episode } from './Episode.js';
import type { EpisodeSource } from './EpisodeSource.js';

/** The shared catalog of one season's episodes, in metrack order. */
export interface SeasonEpisodes {
  seasonId: number;
  episodes: Episode[];
  source: EpisodeSource;
  /** When the catalog was last fetched, as an ISO timestamp. */
  fetchedAt: string;
}
