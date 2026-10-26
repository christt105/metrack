import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import { TmdbMovieSource } from '../providers/tmdb/TmdbMovieSource.js';
import { TmdbSeriesSource } from '../providers/tmdb/TmdbSeriesSource.js';
import type { MovieRepository, SeriesRepository } from '../storage/repositories/index.js';
import type { MetadataCache } from './MetadataCache.js';
import { movieLifecycle } from './movieLifecycle.js';
import { seriesLifecycle } from './seriesLifecycle.js';

/** Makes TMDB the metadata source of movies and series. */
export function registerTmdbMetadata(
  cache: MetadataCache,
  tmdb: TmdbClient,
  repositories: { movies: MovieRepository; series: SeriesRepository },
): void {
  cache.register('movie', {
    repository: repositories.movies,
    source: new TmdbMovieSource(tmdb),
    lifecycle: movieLifecycle,
  });
  cache.register('series', {
    repository: repositories.series,
    source: new TmdbSeriesSource(tmdb),
    lifecycle: seriesLifecycle,
  });
}
