import type { EpisodeRuntime } from './EpisodeRuntime.js';

/** The mean running time of the episodes that have one, rounded; null when none has. */
export function averageRuntime(episodes: readonly EpisodeRuntime[]): number | null {
  const known = episodes.flatMap((episode) =>
    episode.runtime !== null && episode.runtime > 0 ? [episode.runtime] : [],
  );
  if (known.length === 0) return null;
  return Math.round(known.reduce((sum, runtime) => sum + runtime, 0) / known.length);
}
