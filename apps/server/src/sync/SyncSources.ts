import type { LibrarySource } from './LibrarySource.js';
import type { PlaybackSource } from './PlaybackSource.js';

/** Where one Jellyfin account's library and playback history are read from. */
export interface SyncSources {
  library: LibrarySource;
  playback: PlaybackSource;
}
