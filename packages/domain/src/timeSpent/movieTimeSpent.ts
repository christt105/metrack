import type { Movie } from '../Movie.js';
import { tallyTimeSpent } from './tallyTimeSpent.js';
import type { TimeSpent } from './TimeSpent.js';
import { yearOfDate } from './yearOfDate.js';

/**
 * The movie's running time once for the first viewing and once for each finished rewatch. A movie that is not completed has no time spent, and one without a running time has no data.
 */
export function movieTimeSpent(
  movie: Pick<Movie, 'runtime' | 'status' | 'finishedAt' | 'rewatches'>,
): TimeSpent | null {
  const runtime = movie.runtime;
  if (runtime === null || runtime <= 0 || movie.status !== 'completed') return null;
  return tallyTimeSpent([
    { year: yearOfDate(movie.finishedAt), minutes: runtime },
    ...movie.rewatches.flatMap((viewing) =>
      viewing.finishedAt === null
        ? []
        : [{ year: yearOfDate(viewing.finishedAt), minutes: runtime }],
    ),
  ]);
}
