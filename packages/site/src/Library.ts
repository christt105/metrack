import type { PublicEntry } from './PublicEntry.js';
import type { SiteProfile } from './SiteProfile.js';

/** The shown part of a user's library, indexed for the pages. Items pending review are not in it. */
export interface Library {
  handle: string;
  profile: SiteProfile;
  movies: PublicEntry[];
  /** Series that are shown: they have no season at all, or at least one season that is shown. */
  series: PublicEntry[];
  seasons: PublicEntry[];
  videogames: PublicEntry[];
  books: PublicEntry[];
}
