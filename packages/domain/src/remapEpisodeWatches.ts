import type { Episode } from './Episode.js';
import type { EpisodeWatches } from './EpisodeWatches.js';

/**
 * Moves watches to the numbers a refreshed catalog gives the same episodes, matching by TMDB id. A key whose
 * episode has no id, or whose id is not in the new catalog, stays where it was.
 */
export function remapEpisodeWatches(
  oldEpisodes: readonly Episode[],
  newEpisodes: readonly Episode[],
  watched: EpisodeWatches,
): EpisodeWatches {
  const newNumberOf = new Map<number, number>();
  for (const episode of newEpisodes) {
    if (episode.tmdbId !== null) newNumberOf.set(episode.tmdbId, episode.number);
  }
  const idOf = new Map<number, number>();
  for (const episode of oldEpisodes) {
    if (episode.tmdbId !== null) idOf.set(episode.number, episode.tmdbId);
  }
  const moved: EpisodeWatches = {};
  const kept: EpisodeWatches = {};
  for (const [key, viewings] of Object.entries(watched)) {
    const id = idOf.get(Number(key));
    const target = id === undefined ? undefined : newNumberOf.get(id);
    if (target === undefined) kept[key] = viewings;
    else moved[String(target)] = viewings;
  }
  return { ...kept, ...moved };
}
