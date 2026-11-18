import {
  countWatchedEpisodes,
  materializeEpisodeWatches,
  mergeEpisodeWatches,
  normalizeEpisodeWatches,
  normalizeViewings,
  readViewings,
  sameEpisodeWatches,
  viewingsFromDates,
  type EntityRef,
  type Season,
  type SeasonChange,
  type Series,
  type SyncApplyResult,
  type SyncPlan,
} from '@metrack/domain';
import { emptyMovie, emptySeason, emptySeries } from '../media/emptyEntities.js';
import { mergeMovieViewings } from './mergeMovieViewings.js';
import { SharedCatalogError } from '../storage/SharedCatalogError.js';
import type { TransactionRunner } from '../storage/repositories/TransactionRunner.js';
import type { SyncApplyOutcome } from './SyncApplyOutcome.js';
import type { SyncTargets } from './SyncTargets.js';

export const SYNC_SOURCE = 'jellyfin';

/**
 * Writes a sync plan through the repositories in one transaction. Only the fields the plan carries are
 * written, so ratings, reviews, notes and artwork are never touched. Every movie viewing and every season it
 * completes is marked as pending review. On a title other users have too, the shared catalog row is left
 * alone: external ids and season numbers keep their catalog value, and the season title, air date and
 * episode count the library has become this user's overrides.
 */
export class SyncApplier {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly targets: SyncTargets,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async apply(plan: SyncPlan): Promise<SyncApplyOutcome> {
    const result: SyncApplyResult = {
      moviesCreated: 0,
      moviesUpdated: 0,
      seriesCreated: 0,
      seriesUpdated: 0,
      seasonsCreated: 0,
      seasonsUpdated: 0,
      unlinkedAdded: 0,
    };
    const created: EntityRef[] = [];
    await this.transactions.run(() => this.write(plan, result, created));
    return { result, created };
  }

  private async write(
    plan: SyncPlan,
    result: SyncApplyResult,
    created: EntityRef[],
  ): Promise<void> {
    const { movies, series, seasons, unlinked } = this.targets;
    for (const change of plan.movies) {
      const tracking = {
        status: 'completed' as const,
        startedAt: change.startedAt,
        finishedAt: change.finishedAt,
        pendingReview: true,
      };
      if (change.movieId === null) {
        const movie = await movies.create({
          ...emptyMovie(),
          ...tracking,
          rewatches: viewingsFromDates(change.rewatches),
          tmdbId: change.tmdbId,
          jellyfinId: change.jellyfinId,
          title: change.title,
        });
        created.push({ type: 'movie', id: movie.id });
        result.moviesCreated += 1;
      } else {
        const stored = await movies.get(change.movieId);
        await movies.update(change.movieId, {
          ...tracking,
          rewatches: mergeMovieViewings(stored?.rewatches ?? [], change.rewatches),
          jellyfinId: change.jellyfinId,
        });
        result.moviesUpdated += 1;
      }
    }
    for (const change of plan.series) {
      const ids = { tmdbId: change.tmdbId, tvdbId: change.tvdbId, jellyfinId: change.jellyfinId };
      let seriesId = change.seriesId;
      if (seriesId === null) {
        seriesId = (await series.create({ ...emptySeries(), ...ids, title: change.title })).id;
        created.push({ type: 'series', id: seriesId });
        result.seriesCreated += 1;
      } else {
        await this.updateSeries(seriesId, ids);
        result.seriesUpdated += 1;
      }
      let seasonAdded = false;
      for (const season of change.seasons) {
        if (season.seasonId === null) {
          seasonAdded = true;
          const watched = mergeEpisodeWatches(
            season.status === 'completed' ? materializeEpisodeWatches(season.episodeCount) : {},
            normalizeEpisodeWatches(season.watches),
          );
          const added = await seasons.create({
            ...emptySeason(),
            ...seasonFields(season),
            seriesId,
            pendingReview: season.completes,
            rewatches: readViewings(season.rewatches ?? []),
            watchedCount: season.watches
              ? countWatchedEpisodes(watched)
              : season.status === 'completed'
                ? season.episodeCount
                : 0,
          });
          if (season.watches) await this.targets.episodeWatches.set(added.id, watched);
          result.seasonsCreated += 1;
        } else {
          await this.updateSeason(season.seasonId, season);
          await this.mergeWatches(season.seasonId, season);
          result.seasonsUpdated += 1;
        }
      }
      if (seasonAdded && !created.some((r) => r.type === 'series' && r.id === seriesId)) {
        if (((await series.get(seriesId))?.tmdbId ?? null) !== null) {
          created.push({ type: 'series', id: seriesId });
        }
      }
    }
    for (const change of plan.unlinked) {
      await unlinked.create({
        mediaType: change.mediaType,
        title: change.title,
        year: change.year,
        source: SYNC_SOURCE,
        sourceRef: change.jellyfinId,
        createdAt: this.now().toISOString(),
      });
      result.unlinkedAdded += 1;
    }
  }

  private async updateSeries(id: number, ids: Pick<Series, 'tmdbId' | 'tvdbId' | 'jellyfinId'>) {
    try {
      await this.targets.series.update(id, ids);
    } catch (error) {
      if (!(error instanceof SharedCatalogError)) throw error;
      await this.targets.series.update(id, { jellyfinId: ids.jellyfinId });
    }
  }

  private async mergeWatches(id: number, change: SeasonChange): Promise<void> {
    if (!change.watches) return;
    const watches = this.targets.episodeWatches;
    const stored = await watches.get(id);
    const base =
      stored ??
      (change.status === 'completed' ? materializeEpisodeWatches(change.episodeCount) : {});
    const merged = mergeEpisodeWatches(base, normalizeEpisodeWatches(change.watches));
    if (stored === undefined || !sameEpisodeWatches(stored, merged)) await watches.set(id, merged);
  }

  private async personalExtras(id: number, change: SeasonChange): Promise<Partial<Season>> {
    const extras: Partial<Season> = change.completes ? { pendingReview: true } : {};
    if (change.rewatches) {
      const stored = (await this.targets.seasons.get(id))?.rewatches ?? [];
      extras.rewatches = normalizeViewings([
        ...stored.filter((viewing) => viewing.finishedAt !== null),
        ...readViewings(change.rewatches),
      ]);
    }
    if (!change.watches && change.status === 'completed') {
      if ((await this.targets.episodeWatches.get(id)) === undefined) {
        extras.watchedCount = change.episodeCount;
      }
    }
    return extras;
  }

  private async updateSeason(id: number, change: SeasonChange) {
    const { seasons } = this.targets;
    const review = await this.personalExtras(id, change);
    try {
      await seasons.update(id, { ...seasonFields(change), ...review });
    } catch (error) {
      if (!(error instanceof SharedCatalogError)) throw error;
      const stored = await seasons.get(id);
      await seasons.update(id, {
        jellyfinId: change.jellyfinSeasonId,
        status: change.status,
        startedAt: change.startedAt,
        finishedAt: change.finishedAt,
        ...review,
      });
      const metadata = {
        title: change.title,
        firstAirDate: change.firstAirDate,
        episodeCount: change.episodeCount,
      };
      const differing = Object.fromEntries(
        Object.entries(metadata).filter(
          ([field, value]) => stored?.[field as keyof Season] !== value,
        ),
      );
      if (Object.keys(differing).length > 0) await seasons.override(id, differing);
    }
  }
}

function seasonFields(change: SeasonChange) {
  return {
    number: change.number,
    tmdbSeasonNumber: change.tmdbSeasonNumber,
    jellyfinId: change.jellyfinSeasonId,
    title: change.title,
    firstAirDate: change.firstAirDate,
    episodeCount: change.episodeCount,
    status: change.status,
    startedAt: change.startedAt,
    finishedAt: change.finishedAt,
  };
}
