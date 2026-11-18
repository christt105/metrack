import type { OrderedEpisode } from './OrderedEpisode.js';
import type { OrderingSeason } from './OrderingSeason.js';

/**
 * What TMDB says about one series, so the planner can record Jellyfin viewings by TMDB episode id: the TMDB
 * episode id of the TheTVDB episode ids the library has, and the series' ordering (the episode group it follows,
 * or the regular seasons).
 */
export interface SeriesIndex {
  /** TheTVDB episode id, as a string, to TMDB episode id. */
  episodeIds: Readonly<Record<string, number>>;
  seasons: readonly OrderingSeason[];
  episodes: readonly OrderedEpisode[];
}
