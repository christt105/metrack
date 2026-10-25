import type { LibrarySeason } from './LibrarySeason.js';

/** A series in the media server library with the structure the server built for it. */
export interface LibrarySeries {
  jellyfinId: string;
  title: string;
  year: number | null;
  tmdbId: number | null;
  tvdbId: number | null;
  seasons: LibrarySeason[];
}
