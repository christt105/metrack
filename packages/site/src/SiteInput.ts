import type { EpisodeWatchesOfSeries } from './EpisodeWatchesOfSeries.js';
import type { SiteProfile } from './SiteProfile.js';
import type { Book, Movie, Season, SeasonEpisodes, Series, Videogame } from '@metrack/domain';

/** What one user's public pages are built from: only their own data, as stored. */
export interface SiteInput {
  handle: string;
  profile: SiteProfile;
  movies: Movie[];
  series: Series[];
  seasons: Season[];
  videogames: Videogame[];
  books: Book[];
  /** The episode catalogs of the seasons. */
  seasonEpisodes: SeasonEpisodes[];
  /** What the user watched and skipped of each series that has episode watches. */
  episodeWatches: EpisodeWatchesOfSeries[];
}
