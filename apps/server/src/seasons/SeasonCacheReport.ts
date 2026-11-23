import type { SeasonCacheDrift } from './SeasonCacheDrift.js';

export interface SeasonCacheReport {
  /** Whether the entries that differ were rewritten. */
  repaired: boolean;
  seriesChecked: number;
  drifts: SeasonCacheDrift[];
}
