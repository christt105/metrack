import type { ClockReading } from './ClockReading.js';

/** The date and hour of `moment` in an IANA time zone. */
export function readClock(moment: Date, timeZone: string): ClockReading {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(moment);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}
