import type { Season } from './Season.js';
import type { SeasonRefreshUpdate } from './SeasonRefreshUpdate.js';

export interface SeasonRefreshPlan {
  updates: SeasonRefreshUpdate[];
  /** Stored seasons from number 1 up that no provider season was linked to. */
  unlinked: Season[];
}
