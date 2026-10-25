import type { Series } from '../Series.js';
import type { LibrarySeries } from './LibrarySeries.js';
import { pairLibrarySeasons } from './pairLibrarySeasons.js';
import type { SeasonChange } from './SeasonChange.js';
import { planSeasonChange } from './planSeasonChange.js';
import type { SeriesChange } from './SeriesChange.js';
import type { SyncState } from './SyncState.js';
import type { SyncWarning } from './SyncWarning.js';
import type { UnlinkedChange } from './UnlinkedChange.js';

export interface SeriesPlan {
  changes: SeriesChange[];
  unlinked: UnlinkedChange[];
  warnings: SyncWarning[];
}

/** Turns the episode viewings of each library series into season changes, creating series and seasons that do not exist yet. */
export function planSeries(
  library: readonly LibrarySeries[],
  watchDays: ReadonlyMap<string, string[]>,
  playCount: ReadonlyMap<string, number>,
  state: SyncState,
  today: string,
): SeriesPlan {
  const plan: SeriesPlan = { changes: [], unlinked: [], warnings: [] };
  for (const item of library) {
    const watchedSeasons = item.seasons.filter((season) =>
      season.episodes.some((episode) => watchDays.has(episode.jellyfinId)),
    );
    if (watchedSeasons.length === 0) continue;

    const existing: Series | undefined =
      state.series.find((s) => s.jellyfinId === item.jellyfinId) ??
      (item.tvdbId === null ? undefined : state.series.find((s) => s.tvdbId === item.tvdbId)) ??
      (item.tmdbId === null ? undefined : state.series.find((s) => s.tmdbId === item.tmdbId));
    if (!existing && item.tmdbId === null && item.tvdbId === null) {
      const known = state.unlinked.some(
        (u) => u.source === 'jellyfin' && u.sourceRef === item.jellyfinId,
      );
      if (!known) {
        const plays = item.seasons
          .flatMap((s) => s.episodes)
          .reduce((sum, e) => sum + (playCount.get(e.jellyfinId) ?? 0), 0);
        plan.unlinked.push({
          mediaType: 'series',
          jellyfinId: item.jellyfinId,
          title: item.title,
          year: item.year,
          plays,
        });
      }
      continue;
    }

    const storedSeasons = existing ? state.seasons.filter((s) => s.seriesId === existing.id) : [];
    const overrides = existing ? state.overrides.filter((o) => o.seriesId === existing.id) : [];
    const pairs = pairLibrarySeasons(
      watchedSeasons.filter((s) => s.number > 0),
      storedSeasons,
      overrides,
    );
    if (watchedSeasons.some((s) => s.number === 0)) {
      plan.warnings.push({
        code: 'specials_ignored',
        title: item.title,
        message: 'Viewings of specials (season 0) are not synced.',
      });
    }

    const seasons: SeasonChange[] = [];
    for (const pair of pairs) {
      const conflict = storedSeasons.find(
        (s) => s.number === pair.library.number && s.id !== pair.stored?.id,
      );
      if (conflict) {
        plan.warnings.push({
          code: 'season_number_conflict',
          title: item.title,
          message: `Library season ${pair.library.number} has no matching stored season, but number ${pair.library.number} is already used by another one. Add a season override to pair them.`,
        });
        continue;
      }
      const change = planSeasonChange(pair.library, pair.stored, pair.matchedBy, {
        watchDays,
        today,
      });
      if (!change) continue;
      if (
        pair.stored?.episodeCount != null &&
        pair.stored.episodeCount !== change.episodeCount &&
        change.status === 'completed'
      ) {
        plan.warnings.push({
          code: 'episode_count_mismatch',
          title: item.title,
          message: `Season ${change.number} has ${change.episodeCount} episodes in the library but ${pair.stored.episodeCount} stored; the library count wins.`,
        });
      }
      seasons.push(change);
    }

    const needsLink =
      existing !== undefined &&
      (existing.jellyfinId === null ||
        (existing.tvdbId === null && item.tvdbId !== null) ||
        (existing.tmdbId === null && item.tmdbId !== null));
    if (seasons.length === 0 && !needsLink) continue;
    plan.changes.push({
      seriesId: existing?.id ?? null,
      jellyfinId: item.jellyfinId,
      tmdbId: existing?.tmdbId ?? item.tmdbId,
      tvdbId: existing?.tvdbId ?? item.tvdbId,
      title: existing?.title ?? item.title,
      year: item.year,
      seasons,
    });
  }
  return plan;
}
