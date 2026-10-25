import type { DatabaseSync } from 'node:sqlite';
import type { SeasonChange, SyncPlan } from '@metrack/domain';
import { emptyMovie, emptySeason, emptySeries } from '../media/emptyEntities.js';
import type { SyncApplyResult } from './SyncApplyResult.js';
import type { SyncTargets } from './SyncTargets.js';

export const SYNC_SOURCE = 'jellyfin';

/**
 * Writes a sync plan through the repositories in one transaction. Only the fields the plan carries are
 * written, so ratings, reviews, notes and artwork are never touched.
 */
export class SyncApplier {
  constructor(
    private readonly db: DatabaseSync,
    private readonly targets: SyncTargets,
    private readonly now: () => Date = () => new Date(),
  ) {}

  apply(plan: SyncPlan): SyncApplyResult {
    const result: SyncApplyResult = {
      moviesCreated: 0,
      moviesUpdated: 0,
      seriesCreated: 0,
      seriesUpdated: 0,
      seasonsCreated: 0,
      seasonsUpdated: 0,
      unlinkedAdded: 0,
    };
    this.db.exec('BEGIN');
    try {
      this.write(plan, result);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return result;
  }

  private write(plan: SyncPlan, result: SyncApplyResult): void {
    const { movies, series, seasons, unlinked } = this.targets;
    for (const change of plan.movies) {
      const tracking = {
        status: 'completed' as const,
        startedAt: change.startedAt,
        finishedAt: change.finishedAt,
        rewatches: change.rewatches,
      };
      if (change.movieId === null) {
        movies.create({
          ...emptyMovie(),
          ...tracking,
          tmdbId: change.tmdbId,
          jellyfinId: change.jellyfinId,
          title: change.title,
        });
        result.moviesCreated += 1;
      } else {
        movies.update(change.movieId, { ...tracking, jellyfinId: change.jellyfinId });
        result.moviesUpdated += 1;
      }
    }
    for (const change of plan.series) {
      const ids = { tmdbId: change.tmdbId, tvdbId: change.tvdbId, jellyfinId: change.jellyfinId };
      let seriesId = change.seriesId;
      if (seriesId === null) {
        seriesId = series.create({ ...emptySeries(), ...ids, title: change.title }).id;
        result.seriesCreated += 1;
      } else {
        series.update(seriesId, ids);
        result.seriesUpdated += 1;
      }
      for (const season of change.seasons) {
        if (season.seasonId === null) {
          seasons.create({ ...emptySeason(), ...seasonFields(season), seriesId });
          result.seasonsCreated += 1;
        } else {
          seasons.update(season.seasonId, seasonFields(season));
          result.seasonsUpdated += 1;
        }
      }
    }
    for (const change of plan.unlinked) {
      unlinked.create({
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
