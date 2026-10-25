import type { Movie } from '../Movie.js';
import type { Season } from '../Season.js';
import type { SeasonOverride } from '../SeasonOverride.js';
import type { Series } from '../Series.js';
import type { UnlinkedTitle } from '../UnlinkedTitle.js';

/** What the database already holds, as far as the sync is concerned. */
export interface SyncState {
  movies: readonly Movie[];
  series: readonly Series[];
  seasons: readonly Season[];
  overrides: readonly SeasonOverride[];
  unlinked: readonly UnlinkedTitle[];
}
