import type { Season } from '../Season.js';

/** The season whose episode is next for a series, and why. */
export interface NextSeasonPick {
  season: Season;
  /** Episodes viewed before this date do not count as done; null outside a rewatch. */
  rewatchStart: string | null;
  rewatch: boolean;
  newSeason: boolean;
}
