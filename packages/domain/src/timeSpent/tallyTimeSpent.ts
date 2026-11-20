import type { TimedViewing } from './TimedViewing.js';
import type { TimeSpent } from './TimeSpent.js';

/** Adds up timed viewings; null when they add up to nothing. */
export function tallyTimeSpent(viewings: readonly TimedViewing[]): TimeSpent | null {
  let minutes = 0;
  const byYear: Record<string, number> = {};
  for (const viewing of viewings) {
    if (viewing.minutes <= 0) continue;
    minutes += viewing.minutes;
    if (viewing.year !== null) byYear[viewing.year] = (byYear[viewing.year] ?? 0) + viewing.minutes;
  }
  return minutes === 0 ? null : { minutes, byYear };
}
