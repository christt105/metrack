import type { SeasonEpisodeItem, Viewing } from '@metrack/domain';

/** Whether an episode has aired by `today`; one without an air date counts as aired. */
export function hasAired(episode: SeasonEpisodeItem, today: string): boolean {
  return episode.airDate === null || episode.airDate <= today;
}

/** The start of the open season rewatch, or null when none is open. */
export function openRewatchStart(rewatches: readonly Viewing[]): string | null {
  return rewatches.find((viewing) => viewing.finishedAt === null)?.startedAt ?? null;
}

/**
 * Whether the episode counts as done: watched, or during a rewatch viewed on or after its start; a skipped
 * episode is never done, but it is not owed either.
 */
export function isDone(episode: SeasonEpisodeItem, rewatchStart: string | null = null): boolean {
  if (episode.skipped || !episode.watched) return false;
  if (rewatchStart === null) return true;
  return episode.viewings.some((viewing) => (viewing.finishedAt ?? '') >= rewatchStart);
}

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
