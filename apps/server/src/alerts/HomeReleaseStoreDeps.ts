import type {
  MovieRepository,
  ReleaseAlertRepository,
  SeasonOverrideRepository,
  SeasonRepository,
  SeriesRepository,
} from '../storage/repositories/index.js';

export interface HomeReleaseStoreDeps {
  movies: MovieRepository;
  series: SeriesRepository;
  seasons: SeasonRepository;
  overrides: SeasonOverrideRepository;
  alerts: ReleaseAlertRepository;
}
