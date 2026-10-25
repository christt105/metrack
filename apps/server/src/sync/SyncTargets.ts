import type {
  MovieRepository,
  SeasonOverrideRepository,
  SeasonRepository,
  SeriesRepository,
  UnlinkedTitleRepository,
} from '../storage/repositories/index.js';

export interface SyncTargets {
  movies: MovieRepository;
  series: SeriesRepository;
  seasons: SeasonRepository;
  overrides: SeasonOverrideRepository;
  unlinked: UnlinkedTitleRepository;
}
