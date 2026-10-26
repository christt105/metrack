import type { Tracking } from '@metrack/domain';
import type { Activity } from './Activity.js';

/**
 * The activity of tracked items, combined: in progress when any of them is, and the latest of their
 * start, finish and rewatch days. A series passes its seasons.
 */
export function activityOf(items: readonly Partial<Tracking>[]): Activity {
  let active = false;
  let last: string | null = null;
  for (const item of items) {
    if (item.status === 'in_progress') active = true;
    for (const day of [item.startedAt, item.finishedAt, ...(item.rewatches ?? [])]) {
      if (day && (last === null || day > last)) last = day;
    }
  }
  return { active, last };
}
