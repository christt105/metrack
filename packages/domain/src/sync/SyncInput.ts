import type { LibraryMovie } from './LibraryMovie.js';
import type { LibrarySeries } from './LibrarySeries.js';
import type { PlayRecord } from './PlayRecord.js';
import type { SeriesIndex } from './SeriesIndex.js';
import type { SyncState } from './SyncState.js';

export interface SyncInput {
  movies: readonly LibraryMovie[];
  series: readonly LibrarySeries[];
  plays: readonly PlayRecord[];
  state: SyncState;
  /**
   * What TMDB says about each series, by Jellyfin series id. A series with an index records its viewings by TMDB
   * episode id in the seasons of its ordering; one without it, by the library's numbering.
   */
  indexes?: ReadonlyMap<string, SeriesIndex>;
  /** Today as `YYYY-MM-DD`; episodes airing later are not expected to be watched yet. */
  today: string;
  /** IANA time zone used to turn playback timestamps into dates. */
  timeZone: string;
}
