import {
  deriveSeriesTracking,
  episodeKey,
  materializeCompletedSeasons,
  sameEpisodeWatches,
  type Episode,
  type EpisodeState,
  type EpisodeWatches,
  type SeasonEntryUpdate,
} from '@metrack/domain';
import type { SeriesWatchState } from './SeriesWatchState.js';
import type { SeriesWatchTrackerDeps } from './SeriesWatchTrackerDeps.js';

/**
 * Keeps the user's season entries of a series in step with their watches of it: after any change to the watches,
 * the `watched_count`, status and dates of every season whose episodes are known are derived again from them
 * (`deriveSeriesTracking`) and written in the same atomic step as the watches.
 */
export class SeriesWatchTracker {
  private readonly now: () => Date;

  constructor(private readonly deps: SeriesWatchTrackerDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * The seasons of the series with their expected episodes: the complete catalogs, and `known` for the seasons
   * whose catalog the caller has in hand (or falls back to bare numbers for).
   */
  async load(
    seriesId: number,
    known: ReadonlyMap<number, readonly Episode[]> = new Map(),
  ): Promise<SeriesWatchState> {
    const seasons = await this.deps.seasons.listBySeries(seriesId);
    const catalogs = new Map(
      (await this.deps.catalog.listForSeries(seriesId))
        .filter((catalog) => catalog.complete)
        .map((catalog) => [catalog.seasonId, catalog.episodes]),
    );
    return {
      seasons: seasons.flatMap((season) => {
        const episodes = known.get(season.id) ?? catalogs.get(season.id);
        if (!episodes || episodes.length === 0) return [];
        return [
          {
            seasonId: season.id,
            tracking: {
              status: season.status,
              startedAt: season.startedAt,
              finishedAt: season.finishedAt,
              rewatches: season.rewatches,
              abandoned: season.abandoned,
            },
            watchedCount: season.watchedCount,
            skippedCount: season.skippedCount,
            episodes: episodes.map((episode) => ({
              key: episodeKey(episode, season.number),
              airDate: episode.airDate,
            })),
          },
        ];
      }),
      watches: await this.deps.watches.get(seriesId),
      skipped: await this.deps.watches.getSkipped(seriesId),
    };
  }

  /**
   * Applies `edit` to what the user recorded of the series (completed seasons that record none of their episodes
   * count as all watched first, except the skipped ones) and writes the watches and skipped keys with the season
   * entries that follow. `datesOnly` leaves statuses and rewatches alone, for removing episodes. Returns the state
   * after the change and the entries that changed.
   */
  async change(
    seriesId: number,
    state: SeriesWatchState,
    edit: (base: EpisodeState) => EpisodeState,
    datesOnly = false,
  ): Promise<{ watches: EpisodeWatches; skipped: string[]; updates: SeasonEntryUpdate[] }> {
    const base = materializeCompletedSeasons(
      state.seasons,
      state.watches ?? {},
      new Set(state.skipped),
    );
    const next = edit({ watches: base, skipped: state.skipped });
    const now = this.now();
    const skipped = [...next.skipped];
    const updates = deriveSeriesTracking({
      seasons: state.seasons,
      watches: next.watches,
      skipped,
      baseline: base,
      today: now.toISOString().slice(0, 10),
      datesOnly,
    });
    const changed =
      state.watches === undefined
        ? Object.keys(next.watches).length > 0
        : !sameEpisodeWatches(state.watches, next.watches);
    const skipChanged =
      JSON.stringify([...state.skipped].sort()) !== JSON.stringify([...skipped].sort());
    if (changed || skipChanged || updates.length > 0) {
      await this.deps.watches.set(seriesId, next.watches, updates, skipped, now.toISOString());
    }
    return { watches: next.watches, skipped, updates };
  }

  /** Derives every known season entry of the series again from the user's watches, leaving the watches as they are. */
  async recompute(seriesId: number): Promise<void> {
    const state = await this.load(seriesId);
    if (state.watches === undefined) return;
    const updates = deriveSeriesTracking({
      seasons: state.seasons,
      watches: state.watches,
      skipped: state.skipped,
      baseline: state.watches,
      today: this.now().toISOString().slice(0, 10),
      keepUnrecorded: true,
    });
    if (updates.length > 0) await this.deps.watches.set(seriesId, state.watches, updates);
  }
}
