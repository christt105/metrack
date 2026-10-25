import type { MediaStatus } from '../MediaStatus.js';
import type { Season } from '../Season.js';
import type { LibrarySeason } from './LibrarySeason.js';
import type { SeasonChange } from './SeasonChange.js';
import type { SeasonMatchKind } from './SeasonMatchKind.js';
import { seasonAirDate } from './seasonAirDate.js';

export interface SeasonViewing {
  /** Episode id to the sorted dates it was watched. */
  watchDays: ReadonlyMap<string, string[]>;
  today: string;
}

function firstOf(days: readonly string[] | undefined): string | null {
  return days?.[0] ?? null;
}

/**
 * Computes the change for one season, or null when the season has no viewings or nothing would change.
 * The first watched episode starts the season; it completes once every episode is watched and none is still to air,
 * finishing on the day the last one was first watched. Completed seasons keep their dates, and ratings are never touched.
 */
export function planSeasonChange(
  library: LibrarySeason,
  stored: Season | null,
  matchedBy: SeasonMatchKind,
  viewing: SeasonViewing,
): SeasonChange | null {
  const firstDays = library.episodes.flatMap((episode) => {
    const day = firstOf(viewing.watchDays.get(episode.jellyfinId));
    return day === null ? [] : [{ episode, day }];
  });
  if (firstDays.length === 0) return null;
  const watchedIds = new Set(firstDays.map(({ episode }) => episode.jellyfinId));
  const allWatched =
    library.episodes.every((e) => e.airDate === null || e.airDate <= viewing.today) &&
    library.episodes.every((e) => watchedIds.has(e.jellyfinId));
  const started = firstDays.map(({ day }) => day).sort()[0] ?? null;
  const lastFirstWatch =
    firstDays
      .map(({ day }) => day)
      .sort()
      .at(-1) ?? null;

  let status: MediaStatus = stored?.status ?? 'planned';
  let startedAt = stored?.startedAt ?? null;
  let finishedAt = stored?.finishedAt ?? null;
  if (status !== 'completed' && status !== 'dropped') {
    startedAt = startedAt ?? started;
    if (allWatched) {
      status = 'completed';
      finishedAt = lastFirstWatch;
    } else if (status !== 'paused') {
      status = 'in_progress';
    }
  }

  const change: SeasonChange = {
    seasonId: stored?.id ?? null,
    matchedBy,
    jellyfinSeasonId: library.jellyfinId,
    number: library.number,
    tmdbSeasonNumber: tmdbNumberOf(stored, library),
    title: stored?.title ?? library.title,
    firstAirDate: seasonAirDate(library) ?? stored?.firstAirDate ?? null,
    episodeCount: library.episodes.length,
    status,
    startedAt,
    finishedAt,
    watchedEpisodes: watchedIds.size,
    missingRating: status === 'completed' && (stored?.rating ?? null) === null,
  };
  if (stored && isUnchanged(stored, change)) return null;
  return change;
}

function isUnchanged(stored: Season, change: SeasonChange): boolean {
  return (
    stored.jellyfinId === change.jellyfinSeasonId &&
    stored.number === change.number &&
    stored.status === change.status &&
    stored.startedAt === change.startedAt &&
    stored.finishedAt === change.finishedAt &&
    stored.episodeCount === change.episodeCount &&
    stored.firstAirDate === change.firstAirDate
  );
}

function tmdbNumberOf(stored: Season | null, library: LibrarySeason): number | null {
  if (!stored) return null;
  if (stored.tmdbSeasonNumber !== null) return stored.tmdbSeasonNumber;
  return stored.number === library.number ? null : stored.number;
}
