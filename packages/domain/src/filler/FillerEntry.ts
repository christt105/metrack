import type { FillerCategory } from './FillerCategory.js';

/** One row of an AnimeFillerList episode list. `number` is the absolute episode number. */
export interface FillerEntry {
  number: number;
  category: FillerCategory;
  title: string;
}
