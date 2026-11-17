import type { NextEpisode } from './alerts/NextEpisode.js';
import type { Episode } from './Episode.js';

const RECENT_DAYS = 30;

/**
 * Whether new episodes of the season may still appear: the series' next episode belongs to it, or the catalog has an
 * episode that aired in the last 30 days or airs in the future. `seasonNumber` is the number TMDB uses for it.
 */
export function isSeasonAiring(
  nextEpisode: NextEpisode | null,
  seasonNumber: number,
  episodes: readonly Episode[],
  now: Date,
): boolean {
  if (nextEpisode !== null && nextEpisode.seasonNumber === seasonNumber) return true;
  const since = new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return episodes.some((episode) => episode.airDate !== null && episode.airDate >= since);
}
