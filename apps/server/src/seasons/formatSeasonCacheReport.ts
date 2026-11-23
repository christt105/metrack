import type { SeasonCacheDrift } from './SeasonCacheDrift.js';
import type { SeasonDateConflict } from './SeasonDateConflict.js';
import type { SeasonCacheState } from './SeasonCacheState.js';

function describe(state: SeasonCacheState): string {
  const { tracking } = state;
  const rewatches = tracking.rewatches
    .map((viewing) => `${viewing.startedAt ?? '?'}..${viewing.finishedAt ?? 'open'}`)
    .join(' ');
  return `${tracking.status} ${tracking.startedAt ?? '-'}..${tracking.finishedAt ?? '-'} rewatches [${rewatches}] wants ${tracking.wantsRewatch ? 'yes' : 'no'} watched ${state.watchedCount} skipped ${state.skippedCount}`;
}

/** One line per season entry that differs from its episodes, then the totals. */
export function formatSeasonCacheReport(
  entries: readonly { userId: number; drift: SeasonCacheDrift }[],
  seriesChecked: number,
  repaired: boolean,
  conflicts: readonly { userId: number; conflict: SeasonDateConflict }[] = [],
): string {
  const lines = entries.map(
    ({ userId, drift }) =>
      `user ${userId} series ${drift.seriesId} season ${drift.seasonId}: ${drift.fields.join(', ')}\n  stored   ${describe(drift.stored)}\n  computed ${describe(drift.computed)}`,
  );
  for (const { userId, conflict } of conflicts) {
    lines.push(
      `user ${userId} season ${conflict.seasonId}: started ${conflict.startedAt} after finished ${conflict.finishedAt}`,
    );
  }
  lines.push(
    `${entries.length} season entries differ in ${seriesChecked} series${repaired ? ' (repaired)' : ''}, ${conflicts.length} start after finish`,
  );
  return lines.join('\n');
}
