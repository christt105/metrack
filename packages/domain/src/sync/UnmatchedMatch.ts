import type { LibraryEpisode } from './LibraryEpisode.js';
import type { LibrarySeason } from './LibrarySeason.js';

/** A watched episode no TMDB episode of the ordering was found for. */
export interface UnmatchedMatch {
  library: LibrarySeason;
  episode: LibraryEpisode;
}
