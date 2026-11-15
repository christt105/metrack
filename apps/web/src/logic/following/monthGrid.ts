import type { CalendarDay } from './CalendarDay';
import { addDays } from './dates';

/** The weeks of a month (`YYYY-MM`) as full Monday-to-Sunday rows, with the neighbouring days that fill them. */
export function monthGrid(month: string): CalendarDay[][] {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  let date = addDays(first, -weekday);
  const weeks: CalendarDay[][] = [];
  do {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date, day: Number(date.slice(8)), inMonth: date.startsWith(month) });
      date = addDays(date, 1);
    }
    weeks.push(week);
  } while (date.startsWith(month));
  return weeks;
}
