import type { SeasonEpisodesResponse } from '@metrack/domain';

export interface SeasonEpisodesResult {
  response: SeasonEpisodesResponse;
  /** True when opening the season changed its shared `episode_count`, which the library list shows. */
  episodeCountChanged: boolean;
}
