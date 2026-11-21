import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { EpisodeWatchRepository } from '../storage/repositories/EpisodeWatchRepository.js';
import type { SeasonEpisodesRepository } from '../storage/repositories/SeasonEpisodesRepository.js';
import type { SeasonFillerRepository } from '../storage/repositories/SeasonFillerRepository.js';
import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';
import type { SeriesRepository } from '../storage/repositories/SeriesRepository.js';

export interface SeasonEpisodesDeps {
  seasons: SeasonRepository;
  series: SeriesRepository;
  catalog: SeasonEpisodesRepository;
  watches: EpisodeWatchRepository;
  filler: SeasonFillerRepository;
  /** Without it a season without a stored catalog only lists episode numbers. */
  tmdb?: TmdbClient;
  now?: () => Date;
}
