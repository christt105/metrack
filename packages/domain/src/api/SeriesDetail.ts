import type { Season } from '../Season.js';
import type { SeasonOverride } from '../SeasonOverride.js';
import type { Series } from '../Series.js';
import type { MediaDetail } from './MediaDetail.js';

export type SeriesDetail = MediaDetail<Series> & {
  seasons: Season[];
  overrides: SeasonOverride[];
};
