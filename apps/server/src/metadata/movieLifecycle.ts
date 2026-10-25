import type { Movie } from '@metrack/domain';
import type { Lifecycle } from './Lifecycle.js';

export function movieLifecycle(movie: Movie): Lifecycle {
  return {
    releaseDate: movie.releaseDate,
    finished: movie.status === 'completed' || movie.status === 'dropped',
  };
}
