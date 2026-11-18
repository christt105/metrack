import type { LibrarySource } from './LibrarySource.js';
import type { PlaybackSource } from './PlaybackSource.js';
import type { SeriesIndexBuilder } from './SeriesIndexBuilder.js';

/** Where one Jellyfin account's library and playback history are read from. */
export interface SyncSources {
  library: LibrarySource;
  playback: PlaybackSource;
  /** Absent without a TMDB client; series then keep the library's numbering. */
  indexes?: SeriesIndexBuilder;
}
