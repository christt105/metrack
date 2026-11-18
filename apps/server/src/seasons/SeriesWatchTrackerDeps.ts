import type { EpisodeWatchRepository } from '../storage/repositories/EpisodeWatchRepository.js';
import type { SeasonEpisodesRepository } from '../storage/repositories/SeasonEpisodesRepository.js';
import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';

export interface SeriesWatchTrackerDeps {
  seasons: SeasonRepository;
  catalog: SeasonEpisodesRepository;
  watches: EpisodeWatchRepository;
  now?: () => Date;
}
