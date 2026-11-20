import type { Logger } from '../notify/Logger.js';
import { positiveMinutes } from '../providers/tmdb/mapTitle.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { MovieRuntimeRepository } from '../storage/repositories/MovieRuntimeRepository.js';

/** The most movies one batch asks TMDB about, to stay well inside the budget of one invocation. */
export const RUNTIME_BACKFILL_BATCH = 20;

/**
 * Fills in the running time of catalog movies stored before it was kept, a small batch per call. A movie TMDB
 * has no running time for is stored as 0 so it is not asked again; a failed request leaves the movie for the
 * next batch and ends this one.
 */
export class MovieRuntimeBackfill {
  constructor(
    private readonly movies: MovieRuntimeRepository,
    private readonly tmdb: TmdbClient,
    private readonly logger: Logger,
  ) {}

  /** Runs one batch and answers how many movies it stored a running time for. */
  async runBatch(limit = RUNTIME_BACKFILL_BATCH): Promise<number> {
    const missing = await this.movies.listMissing(limit);
    let stored = 0;
    for (const movie of missing) {
      try {
        const details = await this.tmdb.movie(movie.tmdbId);
        await this.movies.set(movie.id, positiveMinutes(details.runtime) ?? 0);
        stored += 1;
      } catch (error) {
        this.logger.error(
          `movie runtime backfill stopped at movie ${movie.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }
    }
    return stored;
  }
}
