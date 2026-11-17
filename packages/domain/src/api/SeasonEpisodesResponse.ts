import type { EpisodeSource } from '../EpisodeSource.js';
import type { SeasonEpisodeItem } from './SeasonEpisodeItem.js';

/**
 * The episodes of one season and what the signed-in user has watched of them. `source` is `numbers` when there
 * is no catalog and the list only has episode numbers; `fetchedAt` is then null.
 */
export interface SeasonEpisodesResponse {
  seasonId: number;
  source: EpisodeSource | 'numbers';
  fetchedAt: string | null;
  episodeCount: number;
  watchedCount: number;
  episodes: SeasonEpisodeItem[];
  catalogMismatch: { catalogEpisodes: number } | null;
}
