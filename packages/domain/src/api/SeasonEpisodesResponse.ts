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
  /** False while the catalog of a very large season is still being filled in; ask again for the rest. */
  complete: boolean;
  episodeCount: number;
  watchedCount: number;
  skippedCount: number;
  episodes: SeasonEpisodeItem[];
}
