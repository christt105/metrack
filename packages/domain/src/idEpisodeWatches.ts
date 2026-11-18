import type { Episode } from './Episode.js';
import type { EpisodeWatches } from './EpisodeWatches.js';
import { episodeKey } from './episodeKey.js';

/**
 * Moves the watches of a season stored under `s<season>e<episode>` keys to the TMDB ids the catalog gives the
 * same episode numbers. A fallback key whose episode has no id, or is not in the catalog, stays as it was.
 * Returns the same object when nothing moves.
 */
export function idEpisodeWatches(
  episodes: readonly Episode[],
  seasonNumber: number,
  watches: EpisodeWatches,
): EpisodeWatches {
  let result = watches;
  for (const episode of episodes) {
    if (episode.tmdbId === null) continue;
    const fallback = episodeKey({ tmdbId: null, number: episode.number }, seasonNumber);
    const viewings = result[fallback];
    if (viewings === undefined) continue;
    if (result === watches) result = { ...watches };
    delete result[fallback];
    result[String(episode.tmdbId)] ??= viewings;
  }
  return result;
}
