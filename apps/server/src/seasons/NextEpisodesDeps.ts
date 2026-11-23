import type { EpisodeWatchRepository } from '../storage/repositories/EpisodeWatchRepository.js';
import type { SeasonEpisodesRepository } from '../storage/repositories/SeasonEpisodesRepository.js';
import type { SeasonFillerRepository } from '../storage/repositories/SeasonFillerRepository.js';
import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';
import type { SeriesRepository } from '../storage/repositories/SeriesRepository.js';

export interface NextEpisodesDeps {
  seasons: SeasonRepository;
  series: SeriesRepository;
  catalog: SeasonEpisodesRepository;
  watches: EpisodeWatchRepository;
  filler: SeasonFillerRepository;
  now?: () => Date;
}
