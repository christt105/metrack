import type { LibraryEpisode } from './LibraryEpisode.js';
import type { LibrarySeason } from './LibrarySeason.js';
import type { OrderedEpisode } from './OrderedEpisode.js';

export interface OrderedMatch {
  library: LibrarySeason;
  episode: LibraryEpisode;
  ordered: OrderedEpisode;
}
