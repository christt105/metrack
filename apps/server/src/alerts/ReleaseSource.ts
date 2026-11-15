import type { MovieRelease } from './MovieRelease.js';
import type { SeriesRelease } from './SeriesRelease.js';

/** Where the watcher learns about upcoming releases. Rejects when the provider fails. */
export interface ReleaseSource {
  /** `episodeGroup` is the TMDB episode group the series' seasons follow, when it has one. */
  series(tmdbId: number, episodeGroup?: string | null): Promise<SeriesRelease>;
  movie(tmdbId: number): Promise<MovieRelease>;
}
