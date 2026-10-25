import { readText } from './fieldReaders.js';

export type DateRead = { value: string | null; odd: boolean };

/** Accepts `YYYY-MM-DD` that is a real calendar date. Empty values are not odd. */
export function parseDate(value: unknown): DateRead {
  const raw = readText(value);
  if (raw === null) return { value: null, odd: false };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return { value: null, odd: true };
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? { value: raw, odd: false } : { value: null, odd: true };
}
