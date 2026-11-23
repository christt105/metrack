import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';
import type { SeasonCacheDrift } from './SeasonCacheDrift.js';
import type { SeasonCacheReport } from './SeasonCacheReport.js';
import type { SeriesWatchTracker } from './SeriesWatchTracker.js';

/**
 * Compares the season entries of the user in scope with what their episodes say (`computeSeasonTracking`), series
 * by series. Reading only reports the entries that differ; repairing also rewrites them, leaving the watches as they
 * are. A season whose catalog is not complete, or that is completed with none of its episodes recorded, has nothing
 * to compare with and is never reported.
 */
export class SeasonCacheChecker {
  constructor(
    private readonly seasons: SeasonRepository,
    private readonly tracker: SeriesWatchTracker,
  ) {}

  /**
   * Checks up to `limit` series starting at the `offset`-th of the user's series in id order, all of them by
   * default. The offset wraps around.
   */
  async run(
    repair: boolean,
    window: { offset: number; limit: number } | undefined = undefined,
  ): Promise<SeasonCacheReport> {
    const all = [...new Set((await this.seasons.list()).map((season) => season.seriesId))].sort(
      (a, b) => a - b,
    );
    const chosen =
      window === undefined || all.length <= window.limit
        ? all
        : Array.from(
            { length: window.limit },
            (_, i) => all[(window.offset + i) % all.length] as number,
          );
    const drifts: SeasonCacheDrift[] = [];
    for (const seriesId of chosen) {
      drifts.push(...(await this.tracker.check(seriesId, repair)));
    }
    return { repaired: repair, seriesChecked: chosen.length, drifts };
  }
}
