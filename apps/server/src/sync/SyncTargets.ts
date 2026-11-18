import type {
  EpisodeWatchRepository,
  MovieRepository,
  SeasonRepository,
  SeriesRepository,
  UnlinkedTitleRepository,
} from '../storage/repositories/index.js';

export interface SyncTargets {
  movies: MovieRepository;
  series: SeriesRepository;
  seasons: SeasonRepository;
  unlinked: UnlinkedTitleRepository;
  episodeWatches: EpisodeWatchRepository;
}
