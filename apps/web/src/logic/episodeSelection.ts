import { hasAired, isDone, unwatchedAired, type SeasonEpisodeItem } from '@metrack/domain';

/** Whether the episode has a viewing with a date, so it cannot be skipped. */
export function hasDatedViewing(episode: SeasonEpisodeItem): boolean {
  return episode.viewings.some((v) => v.startedAt !== null || v.finishedAt !== null);
}

/** How many episodes are done or skipped: the progress toward finishing the season, or the open rewatch. */
export function doneOrSkipped(
  episodes: readonly SeasonEpisodeItem[],
  rewatchStart: string | null = null,
): number {
  return episodes.filter((episode) => episode.skipped || isDone(episode, rewatchStart)).length;
}

/**
 * What "Watched today" marks: the aired episodes still to do, or, when there are none outside a rewatch (a
 * completed season), every aired episode that is not skipped, which adds a viewing of today to each.
 */
export function watchedTodayKeys(
  episodes: readonly SeasonEpisodeItem[],
  today: string,
  rewatchStart: string | null = null,
): string[] {
  const pending = unwatchedAired(episodes, today, undefined, rewatchStart);
  if (pending.length > 0 || rewatchStart !== null) return pending;
  return episodes
    .filter((episode) => !episode.skipped && hasAired(episode, today))
    .map((episode) => episode.key);
}
