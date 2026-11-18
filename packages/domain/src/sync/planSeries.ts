import type { LibrarySeries } from './LibrarySeries.js';
import { draftNumberedSeasons } from './draftNumberedSeasons.js';
import { draftOrderedSeasons } from './draftOrderedSeasons.js';
import { findStoredSeries } from './findStoredSeries.js';
import { planSeasonChanges } from './planSeasonChanges.js';
import type { SeriesIndex } from './SeriesIndex.js';
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
  indexes: ReadonlyMap<string, SeriesIndex> = new Map(),
): SeriesPlan {
  const plan: SeriesPlan = { changes: [], unlinked: [], warnings: [] };
  const storedWatches = new Map((state.watches ?? []).map((row) => [row.seriesId, row.watched]));
  for (const item of library) {
    const watchedSeasons = item.seasons.filter((season) =>
      season.episodes.some((episode) => watchDays.has(episode.jellyfinId)),
    );
    if (watchedSeasons.length === 0) continue;

    const existing = findStoredSeries(state, item);
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
    const index = indexes.get(item.jellyfinId);
    const tmdbId = existing?.tmdbId ?? item.tmdbId;
    const drafted =
      index && tmdbId !== null
        ? draftOrderedSeasons(item.title, watchedSeasons, storedSeasons, watchDays, index)
        : draftNumberedSeasons(item.title, watchedSeasons, storedSeasons, overrides, watchDays);
    plan.warnings.push(...drafted.warnings);
    const { changes: seasons, watches } = planSeasonChanges(
      drafted.drafts,
      drafted.incoming,
      existing ? storedWatches.get(existing.id) : undefined,
      today,
    );
    for (const change of seasons) {
      const stored = storedSeasons.find((s) => s.id === change.seasonId);
      if (
        stored?.episodeCount != null &&
        stored.episodeCount !== change.episodeCount &&
        change.status === 'completed'
      ) {
        plan.warnings.push({
          code: 'episode_count_mismatch',
          title: item.title,
          message: `Season ${change.number} has ${change.episodeCount} episodes in the library but ${stored.episodeCount} stored; the library count wins.`,
        });
      }
    }

    const needsLink =
      existing !== undefined &&
      (existing.jellyfinId === null ||
        (existing.tmdbId === null && (item.tmdbId !== null || item.tvdbId !== null)));
    if (seasons.length === 0 && !watches && !needsLink) continue;
    plan.changes.push({
      seriesId: existing?.id ?? null,
      jellyfinId: item.jellyfinId,
      tmdbId: existing?.tmdbId ?? item.tmdbId,
      tvdbId: existing?.tvdbId ?? item.tvdbId,
      title: existing?.title ?? item.title,
      year: item.year,
      seasons,
      ...(watches ? { watches } : {}),
    });
  }
  return plan;
}
