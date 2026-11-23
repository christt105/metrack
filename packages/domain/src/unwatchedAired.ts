import type { SeasonEpisodeItem } from './api/SeasonEpisodeItem.js';
import { hasAired } from './hasAired.js';
import { isDone } from './isDone.js';

/**
 * The keys of the aired episodes that are neither done nor skipped, up to and including the episode `upToKey`
 * when given. Skipped episodes are never touched.
 */
export function unwatchedAired(
  episodes: readonly SeasonEpisodeItem[],
  today: string,
  upToKey?: string,
  rewatchStart: string | null = null,
): string[] {
  const limit =
    upToKey === undefined ? -1 : episodes.findIndex((episode) => episode.key === upToKey);
  return episodes
    .filter(
      (episode, index) =>
        !episode.skipped &&
        !isDone(episode, rewatchStart) &&
        (limit < 0 || index <= limit) &&
        hasAired(episode, today),
    )
    .map((episode) => episode.key);
}
