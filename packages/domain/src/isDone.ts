import type { SeasonEpisodeItem } from './api/SeasonEpisodeItem.js';
import { liveViewings } from './liveViewings.js';

/**
 * Whether the episode counts as done: watched (not counting abandoned viewings), or during a rewatch viewed on or after its start; a skipped
 * episode is never done, but it is not owed either.
 */
export function isDone(
  episode: Pick<SeasonEpisodeItem, 'skipped' | 'watched' | 'viewings'>,
  rewatchStart: string | null = null,
): boolean {
  if (episode.skipped || !episode.watched) return false;
  if (rewatchStart === null) return true;
  return liveViewings(episode.viewings).some(
    (viewing) => (viewing.finishedAt ?? '') >= rewatchStart,
  );
}
