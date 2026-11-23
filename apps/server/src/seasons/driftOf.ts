import type { SeasonEntryUpdate, SeriesSeasonInput } from '@metrack/domain';
import type { SeasonCacheDrift } from './SeasonCacheDrift.js';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** What differs between a season entry as stored and the update the episodes call for. */
export function driftOf(
  seriesId: number,
  stored: SeriesSeasonInput,
  update: SeasonEntryUpdate,
): SeasonCacheDrift {
  const fields: string[] = [];
  const check = (name: string, before: unknown, after: unknown): void => {
    if (!same(before, after)) fields.push(name);
  };
  check('status', stored.tracking.status, update.tracking.status);
  check('startedAt', stored.tracking.startedAt, update.tracking.startedAt);
  check('finishedAt', stored.tracking.finishedAt, update.tracking.finishedAt);
  check('rewatches', stored.tracking.rewatches, update.tracking.rewatches);
  check('wantsRewatch', stored.tracking.wantsRewatch, update.tracking.wantsRewatch);
  check('watchedCount', stored.watchedCount, update.watchedCount);
  check('skippedCount', stored.skippedCount, update.skippedCount);
  return {
    seriesId,
    seasonId: stored.seasonId,
    fields,
    stored: {
      tracking: stored.tracking,
      watchedCount: stored.watchedCount,
      skippedCount: stored.skippedCount,
    },
    computed: {
      tracking: update.tracking,
      watchedCount: update.watchedCount,
      skippedCount: update.skippedCount,
    },
  };
}
