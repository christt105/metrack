import type { SeasonEpisodeItem } from './api/SeasonEpisodeItem.js';

/** Whether an episode has aired by `today`; one without an air date counts as aired. */
export function hasAired(episode: Pick<SeasonEpisodeItem, 'airDate'>, today: string): boolean {
  return episode.airDate === null || episode.airDate <= today;
}
