import type { Season } from '../Season.js';

/** The season whose episode is next for a series, and why. */
export interface NextSeasonPick {
  season: Season;
  /** Episodes viewed before this date do not count as done; null outside a rewatch. */
  rewatchStart: string | null;
  /** Episodes viewed before this date do not count as done: the rewatch start, or the day the season was last started over. */
  passStart: string | null;
  rewatch: boolean;
  newSeason: boolean;
}
