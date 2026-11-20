import { MAX_TIME_SPENT_MINUTES } from '@metrack/domain';

/**
 * Reads hours typed as a decimal ("12.5", "12,5", "0.25") or as "h:mm" ("12:30") into whole minutes. Blank gives null;
 * anything else, a negative value or one over the limit gives undefined.
 */
export function parseHours(text: string): number | null | undefined {
  const value = text.trim();
  if (value === '') return null;
  const clock = /^(\d+):([0-5]?\d)$/.exec(value);
  const minutes = clock
    ? Number(clock[1]) * 60 + Number(clock[2])
    : /^\d+([.,]\d+)?$/.test(value)
      ? Math.round(Number(value.replace(',', '.')) * 60)
      : Number.NaN;
  if (!Number.isFinite(minutes) || minutes > MAX_TIME_SPENT_MINUTES) return undefined;
  return minutes;
}
