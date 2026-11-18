import { deriveSeasonTracking } from '../deriveSeasonTracking.js';
import type { EpisodeWatches } from '../EpisodeWatches.js';
import { materializeEpisodeWatches } from '../materializeEpisodeWatches.js';
import { mergeEpisodeWatches } from '../mergeEpisodeWatches.js';
import { sameEpisodeWatches } from '../sameEpisodeWatches.js';
import type { Season } from '../Season.js';
import type { LibrarySeason } from './LibrarySeason.js';
import type { SeasonChange } from './SeasonChange.js';
import type { SeasonMatchKind } from './SeasonMatchKind.js';
import { seasonAirDate } from './seasonAirDate.js';
import { countWatchedEpisodes } from '../countWatchedEpisodes.js';

export interface SeasonViewing {
  /** Episode id to the sorted dates it was watched. */
  watchDays: ReadonlyMap<string, string[]>;
  today: string;
  /** What the user already watched of the season; undefined when the season has no stored row. */
  watches?: EpisodeWatches | undefined;
}

/** The viewings Jellyfin has of the numbered episodes of the season, one per day watched, keyed by episode number. */
function incomingWatches(
  library: LibrarySeason,
  watchDays: ReadonlyMap<string, string[]>,
): EpisodeWatches {
  const incoming: EpisodeWatches = {};
  for (const episode of library.episodes) {
    const days = watchDays.get(episode.jellyfinId);
    if (episode.number === null || days === undefined) continue;
    const key = String(episode.number);
    incoming[key] = [
      ...(incoming[key] ?? []),
      ...days.map((finishedAt) => ({ startedAt: null, finishedAt })),
    ];
  }
  return incoming;
}

/**
 * Computes the change for one season, or null when the season has no viewings or nothing would change. The
 * viewings are added to the episodes already watched (nothing is removed) and the season's status and dates follow
 * from them as `deriveSeasonTracking` says. The expected episodes are the library's numbered episodes. A completed
 * season with no stored watches counts as all watched on an unknown date. Ratings are never touched.
 */
export function planSeasonChange(
  library: LibrarySeason,
  stored: Season | null,
  matchedBy: SeasonMatchKind,
  viewing: SeasonViewing,
): SeasonChange | null {
  if (!library.episodes.some((episode) => viewing.watchDays.has(episode.jellyfinId))) return null;
  const base =
    viewing.watches ??
    (stored?.status === 'completed'
      ? materializeEpisodeWatches(stored.episodeCount ?? library.episodes.length)
      : {});
  const merged = mergeEpisodeWatches(base, incomingWatches(library, viewing.watchDays));
  const watchesChanged = !sameEpisodeWatches(base, merged);
  const derived = deriveSeasonTracking({
    tracking: {
      status: stored?.status ?? 'planned',
      startedAt: stored?.startedAt ?? null,
      finishedAt: stored?.finishedAt ?? null,
      rewatches: stored?.rewatches ?? [],
    },
    episodes: library.episodes.flatMap((episode) =>
      episode.number === null ? [] : [{ number: episode.number, airDate: episode.airDate }],
    ),
    watches: merged,
    today: viewing.today,
  });
  const rewatchesChanged =
    JSON.stringify(derived.rewatches) !== JSON.stringify(stored?.rewatches ?? []);

  const change: SeasonChange = {
    seasonId: stored?.id ?? null,
    matchedBy,
    jellyfinSeasonId: library.jellyfinId,
    number: library.number,
    tmdbSeasonNumber: tmdbNumberOf(stored, library),
    title: stored?.title ?? library.title,
    firstAirDate: seasonAirDate(library) ?? stored?.firstAirDate ?? null,
    episodeCount: library.episodes.length,
    status: derived.status,
    startedAt: derived.startedAt,
    finishedAt: derived.finishedAt,
    watchedEpisodes: countWatchedEpisodes(merged),
    completes: derived.status === 'completed' && stored?.status !== 'completed',
    missingRating: derived.status === 'completed' && (stored?.rating ?? null) === null,
    ...(watchesChanged ? { watches: merged } : {}),
    ...(rewatchesChanged ? { rewatches: derived.rewatches } : {}),
  };
  if (stored && !watchesChanged && !rewatchesChanged && isUnchanged(stored, change)) return null;
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
