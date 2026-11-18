import type {
  MovieRepository,
  ReleaseAlertRepository,
  SeasonRepository,
  SeriesRepository,
} from '../storage/repositories/index.js';

export interface HomeReleaseStoreDeps {
  movies: MovieRepository;
  series: SeriesRepository;
  seasons: SeasonRepository;
  alerts: ReleaseAlertRepository;
  now?: () => Date;
}
