import type { Episode } from '../Episode.js';

/** A season of the series with the episodes of its catalog, in catalog order. */
export interface FillerSeason {
  seasonId: number;
  seasonNumber: number;
  episodes: readonly Episode[];
}
