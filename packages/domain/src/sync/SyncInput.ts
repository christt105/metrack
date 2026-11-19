import type { LibraryMovie } from './LibraryMovie.js';
import type { LibrarySeries } from './LibrarySeries.js';
import type { PlayRecord } from './PlayRecord.js';
import type { SeriesIndex } from './SeriesIndex.js';
import type { SyncState } from './SyncState.js';

export interface SyncInput {
  movies: readonly LibraryMovie[];
  series: readonly LibrarySeries[];
  plays: readonly PlayRecord[];
  /**
   * Playback of the companion accounts. When present (even empty), an item the tracked account marked as played with no
   * playback of its own counts as watched: on the day a companion played it completely in the `COMPANION_WINDOW_DAYS`
   * days up to the mark, or on no known day. Absent, such items are ignored.
   */
  companionPlays?: readonly PlayRecord[];
  state: SyncState;
  /**
   * What TMDB says about each series, by Jellyfin series id. A series with an index records its viewings by TMDB
   * episode id in the seasons of its ordering; one without it, by the library's numbering.
   */
  indexes?: ReadonlyMap<string, SeriesIndex>;
  /** Jellyfin series ids whose watched episodes are all recorded already; the planner leaves them out. */
  settled?: ReadonlySet<string>;
  /** Today as `YYYY-MM-DD`; episodes airing later are not expected to be watched yet. */
  today: string;
  /** IANA time zone used to turn playback timestamps into dates. */
  timeZone: string;
}
