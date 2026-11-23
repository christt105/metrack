import type { SeasonCacheState } from './SeasonCacheState.js';

/** A season entry whose stored cache differs from what its episodes say. */
export interface SeasonCacheDrift {
  seriesId: number;
  seasonId: number;
  /** The names of the fields that differ. */
  fields: string[];
  stored: SeasonCacheState;
  computed: SeasonCacheState;
}
