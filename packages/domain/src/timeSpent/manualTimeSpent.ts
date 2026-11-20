import type { Book } from '../Book.js';
import type { Videogame } from '../Videogame.js';
import { tallyTimeSpent } from './tallyTimeSpent.js';
import type { TimeSpent } from './TimeSpent.js';
import { yearOfDate } from './yearOfDate.js';

/** The minutes a user typed in for a game or book, placed in the year the item finished. */
export function manualTimeSpent(
  item: Pick<Videogame | Book, 'timeSpentMinutes' | 'finishedAt'>,
): TimeSpent | null {
  if (item.timeSpentMinutes === null) return null;
  return tallyTimeSpent([{ year: yearOfDate(item.finishedAt), minutes: item.timeSpentMinutes }]);
}
