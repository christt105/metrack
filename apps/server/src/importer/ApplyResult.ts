import type { Tally } from './Tally.js';

export interface ApplyResult {
  movies: Tally;
  series: Tally;
  seasons: Tally;
  videogames: Tally;
  books: Tally;
  unlinked: Tally;
  /** Unlinked inbox rows removed because their note now has an id. */
  unlinkedResolved: number;
  images: {
    /** Local files copied into the store, or found already stored. */
    localStored: number;
    /** Remote URLs linked to an existing local copy. */
    remoteLinked: number;
    /** Remote URLs with no local copy; the cover or banner stays empty. */
    remoteUnavailable: number;
  };
  warnings: string[];
}
