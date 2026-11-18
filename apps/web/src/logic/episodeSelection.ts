import type { SeasonEpisodeItem } from '@metrack/domain';

/** Whether an episode has aired by `today`; one without an air date counts as aired. */
export function hasAired(episode: SeasonEpisodeItem, today: string): boolean {
  return episode.airDate === null || episode.airDate <= today;
}

/** The keys of the unwatched episodes that have aired, up to and including the episode `upToKey` when given. */
export function unwatchedAired(
  episodes: readonly SeasonEpisodeItem[],
  today: string,
  upToKey?: string,
): string[] {
  const limit =
    upToKey === undefined ? -1 : episodes.findIndex((episode) => episode.key === upToKey);
  return episodes
    .filter(
      (episode, index) =>
        !episode.watched && (limit < 0 || index <= limit) && hasAired(episode, today),
    )
    .map((episode) => episode.key);
}
