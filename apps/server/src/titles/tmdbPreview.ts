export const TMDB_POSTER_PREVIEW = 'https://image.tmdb.org/t/p/w185';

/** The year of an ISO date string, or null when it is missing or malformed. */
export function yearFrom(date: string | undefined): number | null {
  return date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
}
