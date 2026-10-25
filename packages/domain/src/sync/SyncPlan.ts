import type { MovieChange } from './MovieChange.js';
import type { SeriesChange } from './SeriesChange.js';
import type { SyncWarning } from './SyncWarning.js';
import type { UnmatchedTitle } from './UnmatchedTitle.js';
import type { UnlinkedChange } from './UnlinkedChange.js';

/** The changes a sync would make. Computing it writes nothing. */
export interface SyncPlan {
  movies: MovieChange[];
  series: SeriesChange[];
  unlinked: UnlinkedChange[];
  warnings: SyncWarning[];
  /** Playback records that match no movie or episode of the library. */
  ignoredPlays: number;
  /** Titles behind the ignored playback, most played first. These were removed from the library or re-added under new ids. */
  unmatchedTitles: UnmatchedTitle[];
}
