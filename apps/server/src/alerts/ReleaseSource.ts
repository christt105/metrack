import type { MovieRelease } from './MovieRelease.js';
import type { SeriesRelease } from './SeriesRelease.js';

/** Where the watcher learns about upcoming releases. Rejects when the provider fails. */
export interface ReleaseSource {
  series(tmdbId: number): Promise<SeriesRelease>;
  movie(tmdbId: number): Promise<MovieRelease>;
}
