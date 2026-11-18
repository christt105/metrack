import { episodeKey } from '../episodeKey.js';
import type { EpisodeWatches } from '../EpisodeWatches.js';
import type { Season } from '../Season.js';
import type { SeasonOverride } from '../SeasonOverride.js';
import { addWatchDays } from './addWatchDays.js';
import type { LibrarySeason } from './LibrarySeason.js';
import { pairLibrarySeasons } from './pairLibrarySeasons.js';
import { seasonAirDate } from './seasonAirDate.js';
import type { SeasonDraft } from './SeasonDraft.js';
import type { SeriesDrafts } from './SeriesDrafts.js';

function tmdbNumberOf(stored: Season | null, library: LibrarySeason): number | null {
  if (!stored) return null;
  if (stored.tmdbSeasonNumber !== null) return stored.tmdbSeasonNumber;
  return stored.number === library.number ? null : stored.number;
}

/**
 * The library's own numbering: each library season is paired with a stored one and its watched episodes are
 * recorded under `s<season>e<episode>` keys, since there is no TMDB id to name them by.
 */
export function draftNumberedSeasons(
  title: string,
  watchedSeasons: readonly LibrarySeason[],
  storedSeasons: readonly Season[],
  overrides: readonly SeasonOverride[],
  watchDays: ReadonlyMap<string, string[]>,
): SeriesDrafts {
  const result: SeriesDrafts = { drafts: [], incoming: {} as EpisodeWatches, warnings: [] };
  const pairs = pairLibrarySeasons(
    watchedSeasons.filter((s) => s.number > 0),
    storedSeasons,
    overrides,
  );
  if (watchedSeasons.some((s) => s.number === 0)) {
    result.warnings.push({
      code: 'specials_ignored',
      title,
      message: 'Viewings of specials (season 0) are not synced.',
    });
  }
  for (const pair of pairs) {
    const conflict = storedSeasons.find(
      (s) => s.number === pair.library.number && s.id !== pair.stored?.id,
    );
    if (conflict) {
      result.warnings.push({
        code: 'season_number_conflict',
        title,
        message: `Library season ${pair.library.number} has no matching stored season, but number ${pair.library.number} is already used by another one. Add a season override to pair them.`,
      });
      continue;
    }
    const numbered = pair.library.episodes.filter(
      (episode): episode is typeof episode & { number: number } => episode.number !== null,
    );
    const unnumbered = pair.library.episodes.filter(
      (episode) => episode.number === null && watchDays.has(episode.jellyfinId),
    ).length;
    if (unnumbered > 0) {
      result.warnings.push({
        code: 'episode_without_number',
        title,
        message: `Season ${pair.library.number} has ${unnumbered} watched episode${unnumbered === 1 ? '' : 's'} without a number in the library, so ${unnumbered === 1 ? 'it was' : 'they were'} not recorded as watched.`,
      });
    }
    const keyOf = (number: number) => episodeKey({ tmdbId: null, number }, pair.library.number);
    let watched = false;
    for (const episode of numbered) {
      const days = watchDays.get(episode.jellyfinId);
      if (days === undefined) continue;
      watched = true;
      addWatchDays(result.incoming, keyOf(episode.number), days);
    }
    if (!watched) continue;
    result.drafts.push({
      stored: pair.stored,
      matchedBy: pair.matchedBy,
      jellyfinSeasonId: pair.library.jellyfinId,
      number: pair.library.number,
      tmdbSeasonNumber: tmdbNumberOf(pair.stored, pair.library),
      title: pair.stored?.title ?? pair.library.title,
      firstAirDate: seasonAirDate(pair.library) ?? pair.stored?.firstAirDate ?? null,
      episodeCount: pair.library.episodes.length,
      expected: numbered.map((episode) => ({
        key: keyOf(episode.number),
        airDate: episode.airDate,
      })),
    } satisfies SeasonDraft);
  }
  return result;
}
