import type { Artwork } from './Artwork.js';
import type { Tracking } from './Tracking.js';

/**
 * The unit that is followed and rated. `number` is the canonical number (Jellyfin/TVDB when known),
 * `tmdbSeasonNumber` is the number TMDB uses for the same season.
 */
export interface Season extends Tracking, Artwork {
  id: number;
  seriesId: number;
  number: number;
  tmdbSeasonNumber: number | null;
  jellyfinId: string | null;
  title: string | null;
  overview: string | null;
  firstAirDate: string | null;
  episodeCount: number | null;
}
