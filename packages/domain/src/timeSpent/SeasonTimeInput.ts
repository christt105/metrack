import type { EpisodeWatches } from '../EpisodeWatches.js';
import type { EpisodeRuntime } from './EpisodeRuntime.js';

/**
 * What the time spent on one season is computed from. `episodes` is the season's catalog, or null without one. `watches` and `skipped` may hold the whole series: only the keys of `episodes` are read. `seriesRuntime` is the series' usual episode running time.
 */
export interface SeasonTimeInput {
  episodes: readonly EpisodeRuntime[] | null;
  watches: EpisodeWatches;
  skipped: ReadonlySet<string>;
  seriesRuntime: number | null;
  watchedCount: number;
  finishedAt: string | null;
}
