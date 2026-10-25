import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type {
  MovieRepository,
  ReleaseAlertRepository,
  SeasonOverrideRepository,
  SeasonRepository,
  SeriesRepository,
} from '../storage/repositories/index.js';
import type { ReleaseSource } from './ReleaseSource.js';

export interface ReleaseWatcherDeps {
  movies: MovieRepository;
  series: SeriesRepository;
  seasons: SeasonRepository;
  overrides: SeasonOverrideRepository;
  alerts: ReleaseAlertRepository;
  source: ReleaseSource;
  notifier: Notifier;
  logger: Logger;
  /** IANA time zone that decides what "today" and "tomorrow" mean. */
  timeZone: string;
  /** Nothing is checked or sent before this local hour, so alerts do not arrive at night. */
  notifyFromHour: number;
  now?: () => Date;
}
