import type { LibraryEpisode } from './LibraryEpisode.js';
import type { LibrarySeason } from './LibrarySeason.js';

/** The watched episodes TMDB places in one other series. */
export interface ForeignMatch {
  showName: string;
  episodes: { library: LibrarySeason; episode: LibraryEpisode }[];
}
