import type { ForeignEpisode } from './ForeignEpisode.js';
import type { OrderedEpisode } from './OrderedEpisode.js';
import type { OrderingSeason } from './OrderingSeason.js';

/**
 * What TMDB says about one series, so the planner can record Jellyfin viewings by TMDB episode id: the TMDB
 * episode id of the TheTVDB episode ids the library has, and the series' ordering (the episode group it follows,
 * or the regular seasons).
 */
export interface SeriesIndex {
  /** The TMDB id of the series being synced. */
  tmdbId: number;
  /** Its TMDB name, for messages. */
  name: string;
  /** TheTVDB episode id, as a string, to the other TMDB series TMDB says the episode belongs to. Never in `episodeIds`. */
  foreignEpisodes: Readonly<Record<string, ForeignEpisode>>;
  /** TheTVDB episode id, as a string, to TMDB episode id. */
  episodeIds: Readonly<Record<string, number>>;
  seasons: readonly OrderingSeason[];
  episodes: readonly OrderedEpisode[];
}
