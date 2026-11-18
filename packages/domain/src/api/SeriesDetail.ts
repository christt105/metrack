import type { Season } from '../Season.js';
import type { Series } from '../Series.js';
import type { UnmatchedEpisode } from '../sync/UnmatchedEpisode.js';
import type { MediaDetail } from './MediaDetail.js';

export type SeriesDetail = MediaDetail<Series> & {
  seasons: Season[];
  /** The watched library episodes the last sync could not record, for the signed-in user. */
  unmatched: UnmatchedEpisode[];
};
