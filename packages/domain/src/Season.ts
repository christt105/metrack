import type { AbandonedPass } from './AbandonedPass.js';
import type { Artwork } from './Artwork.js';
import type { Tracking } from './Tracking.js';

/**
 * The unit that is followed and rated. `number` is the canonical number (Jellyfin/TVDB when known),
 * `tmdbSeasonNumber` is the number TMDB uses for the same season, or the order inside the series' episode group when it has one.
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
  /** Distinct episodes the user has watched; a completed season without stored watches counts as all of them. */
  watchedCount: number;
  /** Episodes the user skipped: not watched, but not owed for the season to be complete. */
  skippedCount: number;
  slug: string | null;
  tags: string[];
  /** The passes left to start the season over, oldest first; see `SeasonTracking`. */
  abandoned: AbandonedPass[];
}
