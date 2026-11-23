import type { EpisodeSource } from '../EpisodeSource.js';
import type { NextEpisodeAvailability } from './NextEpisodeAvailability.js';
import type { NextEpisodeLabel } from './NextEpisodeLabel.js';
import type { NextEpisodeProgress } from './NextEpisodeProgress.js';
import type { NextEpisodeSeason } from './NextEpisodeSeason.js';
import type { NextEpisodeSeries } from './NextEpisodeSeries.js';
import type { NextEpisodeTarget } from './NextEpisodeTarget.js';

/** One series of the next-episode list: what to watch next and everything needed to show it. */
export interface NextEpisodeRow {
  series: NextEpisodeSeries;
  season: NextEpisodeSeason;
  episode: NextEpisodeTarget;
  /** `numbers` when the season has no stored catalog and the episode is only a number. */
  source: EpisodeSource | 'numbers';
  availability: NextEpisodeAvailability;
  /** The date the episode or season airs, set when `availability` is not `ready`. */
  airsOn: string | null;
  labels: NextEpisodeLabel[];
  progress: NextEpisodeProgress;
  /** When the user last marked or skipped an episode of the series; null for series from before it was recorded. */
  lastActivityAt: string | null;
}
