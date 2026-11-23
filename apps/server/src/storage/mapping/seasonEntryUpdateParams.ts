import { normalizeViewings, type SeasonEntryUpdate } from '@metrack/domain';

/** The parameters of `UPDATE_TRACKING_SQL` for one season entry of a user. */
export function seasonEntryUpdateParams(
  userId: number,
  update: SeasonEntryUpdate,
): [number, number, string, string | null, string | null, string, string, number, number] {
  const { tracking } = update;
  return [
    update.watchedCount,
    update.skippedCount,
    tracking.status,
    tracking.startedAt,
    tracking.finishedAt,
    JSON.stringify(normalizeViewings(tracking.rewatches)),
    JSON.stringify(tracking.abandoned),
    userId,
    update.seasonId,
  ];
}
