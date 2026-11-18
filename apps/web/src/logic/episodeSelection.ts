import type { SeasonEpisodeItem } from '@metrack/domain';

/** Whether an episode has aired by `today`; one without an air date counts as aired. */
export function hasAired(episode: SeasonEpisodeItem, today: string): boolean {
  return episode.airDate === null || episode.airDate <= today;
}

/** The numbers of the unwatched episodes that have aired, up to and including `upTo` when given. */
export function unwatchedAired(
  episodes: readonly SeasonEpisodeItem[],
  today: string,
  upTo: number = Number.POSITIVE_INFINITY,
): number[] {
  return episodes
    .filter((episode) => !episode.watched && episode.number <= upTo && hasAired(episode, today))
    .map((episode) => episode.number);
}
