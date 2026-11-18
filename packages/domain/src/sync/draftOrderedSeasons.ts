import type { Season } from '../Season.js';
import { addWatchDays } from './addWatchDays.js';
import type { LibrarySeason } from './LibrarySeason.js';
import { matchOrderedEpisodes } from './matchOrderedEpisodes.js';
import type { SeriesDrafts } from './SeriesDrafts.js';
import type { SeriesIndex } from './SeriesIndex.js';

/**
 * The series' TMDB ordering: each watched episode is recorded under its TMDB episode id in the season of the
 * ordering that holds it, whatever numbering the library uses. A stored season is paired by the number TMDB gives
 * it in the ordering; the seasons of the ordering the series lacks are created. Watched episodes of specials
 * (season 0) are ignored.
 */
export function draftOrderedSeasons(
  title: string,
  watchedSeasons: readonly LibrarySeason[],
  storedSeasons: readonly Season[],
  watchDays: ReadonlyMap<string, string[]>,
  index: SeriesIndex,
): SeriesDrafts {
  const result: SeriesDrafts = { drafts: [], incoming: {}, warnings: [] };
  if (watchedSeasons.some((s) => s.number === 0)) {
    result.warnings.push({
      code: 'specials_ignored',
      title,
      message: 'Viewings of specials (season 0) are not synced.',
    });
  }
  const { matches, unmatched, foreign } = matchOrderedEpisodes(
    watchedSeasons.filter((s) => s.number > 0),
    (episode) => watchDays.has(episode.jellyfinId),
    index,
  );
  for (const [showId, { showName, count }] of foreign) {
    result.warnings.push({
      code: 'episode_other_series',
      title,
      message: `${count} watched episode${count === 1 ? ' belongs' : 's belong'} to "${showName}" (TMDB ${showId}) on TMDB, not to "${index.name}" (TMDB ${index.tmdbId}), so ${count === 1 ? 'it was' : 'they were'} not recorded as watched. The Jellyfin numbering or metadata of this series is probably off.`,
    });
  }
  if (unmatched > 0) {
    result.warnings.push({
      code: 'episode_unmatched',
      title,
      message: `${unmatched} watched episode${unmatched === 1 ? ' has' : 's have'} no matching TMDB episode (by TheTVDB id or a unique air date), so ${unmatched === 1 ? 'it was' : 'they were'} not recorded as watched.`,
    });
  }
  const taken = new Set(storedSeasons.map((s) => s.number));
  const numbers = [...new Set(matches.map((m) => m.ordered.seasonNumber))].sort((a, b) => a - b);
  for (const seasonNumber of numbers) {
    const own = matches.filter((m) => m.ordered.seasonNumber === seasonNumber);
    for (const { episode, ordered } of own) {
      addWatchDays(
        result.incoming,
        String(ordered.tmdbId),
        watchDays.get(episode.jellyfinId) ?? [],
      );
    }
    const episodes = index.episodes.filter((e) => e.seasonNumber === seasonNumber);
    const expected = episodes.map((e) => ({ key: String(e.tmdbId), airDate: e.airDate }));
    const ordering = index.seasons.find((s) => s.number === seasonNumber);
    const dates = episodes.flatMap((e) => (e.airDate === null ? [] : [e.airDate]));
    const firstAirDate =
      ordering?.firstAirDate ?? (dates.length > 0 ? (dates.sort()[0] ?? null) : null);
    const stored = storedSeasons.find((s) => (s.tmdbSeasonNumber ?? s.number) === seasonNumber);
    if (stored) {
      result.drafts.push({
        stored,
        matchedBy: 'ordering',
        jellyfinSeasonId: stored.jellyfinId,
        number: stored.number,
        tmdbSeasonNumber: stored.tmdbSeasonNumber,
        title: stored.title,
        firstAirDate: stored.firstAirDate ?? firstAirDate,
        episodeCount: stored.episodeCount ?? episodes.length,
        expected,
      });
      continue;
    }
    const number = taken.has(seasonNumber) ? Math.max(0, ...taken) + 1 : seasonNumber;
    taken.add(number);
    result.drafts.push({
      stored: null,
      matchedBy: 'new',
      jellyfinSeasonId: own[0]?.library.jellyfinId ?? null,
      number,
      tmdbSeasonNumber: seasonNumber,
      title: ordering?.title ?? null,
      firstAirDate,
      episodeCount: episodes.length,
      expected,
    });
  }
  return result;
}
