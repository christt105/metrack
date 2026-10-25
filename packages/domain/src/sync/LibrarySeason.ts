import type { LibraryEpisode } from './LibraryEpisode.js';

export interface LibrarySeason {
  jellyfinId: string;
  number: number;
  title: string | null;
  episodes: LibraryEpisode[];
}
