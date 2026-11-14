import type { CloudBackupTime } from './CloudBackupTime.js';

/** The next local time of day after `now`, as a number of milliseconds from `now`. */
export function nextDailyRun(now: Date, time: CloudBackupTime): number {
  const next = new Date(now);
  next.setHours(time.hour, time.minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
