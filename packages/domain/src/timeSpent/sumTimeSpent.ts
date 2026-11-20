import type { TimeSpent } from './TimeSpent.js';

/** Adds the given amounts together, skipping the ones without data; null when none has any. */
export function sumTimeSpent(parts: readonly (TimeSpent | null)[]): TimeSpent | null {
  let minutes = 0;
  const byYear: Record<string, number> = {};
  for (const part of parts) {
    if (part === null) continue;
    minutes += part.minutes;
    for (const [year, value] of Object.entries(part.byYear))
      byYear[year] = (byYear[year] ?? 0) + value;
  }
  return minutes === 0 ? null : { minutes, byYear };
}
