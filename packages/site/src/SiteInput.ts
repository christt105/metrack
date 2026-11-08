import type { SiteProfile } from './SiteProfile.js';
import type { Book, Movie, Season, Series, Videogame } from '@metrack/domain';

/** What one user's public pages are built from: only their own data, as stored. */
export interface SiteInput {
  handle: string;
  profile: SiteProfile;
  movies: Movie[];
  series: Series[];
  seasons: Season[];
  videogames: Videogame[];
  books: Book[];
}
