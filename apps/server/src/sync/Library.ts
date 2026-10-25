import type { LibraryMovie, LibrarySeries } from '@metrack/domain';

export interface Library {
  movies: LibraryMovie[];
  series: LibrarySeries[];
}
