import type { LibrarySeason } from './LibrarySeason.js';

/** Date of the earliest dated episode of a season, or null when no episode has an air date. */
export function seasonAirDate(season: LibrarySeason): string | null {
  const dates = season.episodes.flatMap((e) => (e.airDate === null ? [] : [e.airDate]));
  return dates.length === 0 ? null : dates.reduce((a, b) => (a < b ? a : b));
}
