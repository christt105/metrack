import type { FillerCounts } from './FillerCounts.js';
import type { FillerPreviewEpisode } from './FillerPreviewEpisode.js';

/** The episodes of a series classified by AnimeFillerList, for the "Skip the filler" preview. */
export interface FillerPreviewResponse {
  slug: string;
  sourceUrl: string;
  counts: FillerCounts;
  episodes: FillerPreviewEpisode[];
}
