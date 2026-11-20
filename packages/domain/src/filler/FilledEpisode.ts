import type { FillerCategory } from './FillerCategory.js';

/** An episode of the series paired with its absolute number and category in the list. */
export interface FilledEpisode {
  seasonId: number;
  seasonNumber: number;
  key: string;
  number: number;
  title: string | null;
  absoluteNumber: number;
  category: FillerCategory;
}
