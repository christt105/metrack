import type { LibraryMovie } from './LibraryMovie.js';
import type { LibrarySeries } from './LibrarySeries.js';
import type { PlayRecord } from './PlayRecord.js';
import type { SyncState } from './SyncState.js';

export interface SyncInput {
  movies: readonly LibraryMovie[];
  series: readonly LibrarySeries[];
  plays: readonly PlayRecord[];
  state: SyncState;
  /** Today as `YYYY-MM-DD`; episodes airing later are not expected to be watched yet. */
  today: string;
  /** IANA time zone used to turn playback timestamps into dates. */
  timeZone: string;
}
