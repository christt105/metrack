import { normalizeViewings, type SeasonEntryUpdate } from '@metrack/domain';

/** The parameters of `UPDATE_TRACKING_SQL` for one season entry of a user. */
export function seasonEntryUpdateParams(
  userId: number,
  update: SeasonEntryUpdate,
): [number, number, string, string | null, string | null, string, number, number, number] {
  const { tracking } = update;
  return [
    update.watchedCount,
    update.skippedCount,
    tracking.status,
    tracking.startedAt,
    tracking.finishedAt,
    JSON.stringify(normalizeViewings(tracking.rewatches)),
    tracking.wantsRewatch ? 1 : 0,
    userId,
    update.seasonId,
  ];
}
