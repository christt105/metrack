import type { ExpectedEpisode } from './ExpectedEpisode.js';
import type { Viewing } from './Viewing.js';

function isAired(episode: ExpectedEpisode, today: string): boolean {
  return episode.airDate === null || episode.airDate <= today;
}

/**
 * How many passes over the season are complete, counting from the first: the first needs every episode that is not
 * skipped to have aired and have a viewing, a later one every aired episode that is not skipped to have that many.
 */
export function countCompletePasses(
  own: ReadonlyMap<string, readonly Viewing[]>,
  episodes: readonly ExpectedEpisode[],
  skipped: ReadonlySet<string>,
  today: string,
): number {
  const required = episodes.filter((e) => !skipped.has(e.key));
  const airedRequired = required.filter((e) => isAired(e, today));
  const most = Math.max(0, ...[...own.values()].map((v) => v.length));
  const isComplete = (pass: number): boolean =>
    pass === 1
      ? required.length > 0 && required.every((e) => isAired(e, today) && own.has(e.key))
      : airedRequired.length > 0 &&
        airedRequired.every((e) => (own.get(e.key)?.length ?? 0) >= pass);
  let complete = 0;
  while (complete < most && isComplete(complete + 1)) complete += 1;
  return complete;
}
