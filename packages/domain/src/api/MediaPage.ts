import type { MediaSummary } from './MediaSummary.js';

/** A page of the combined list. `total` counts every match, not only this page. */
export interface MediaPage {
  items: MediaSummary[];
  total: number;
}
