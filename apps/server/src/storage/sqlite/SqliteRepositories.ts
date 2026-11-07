import type { ApiTokenRepository } from '../repositories/ApiTokenRepository.js';
import type { BookRepository } from '../repositories/BookRepository.js';
import type { ImageRepository } from '../repositories/ImageRepository.js';
import type { MetadataStateRepository } from '../repositories/MetadataStateRepository.js';
import type { MovieRepository } from '../repositories/MovieRepository.js';
import type { ReleaseAlertRepository } from '../repositories/ReleaseAlertRepository.js';
import type { SeasonOverrideRepository } from '../repositories/SeasonOverrideRepository.js';
import type { SeasonRepository } from '../repositories/SeasonRepository.js';
import type { SessionRepository } from '../repositories/SessionRepository.js';
import type { SeriesRepository } from '../repositories/SeriesRepository.js';
import type { TransactionRunner } from '../repositories/TransactionRunner.js';
import type { UnlinkedTitleRepository } from '../repositories/UnlinkedTitleRepository.js';
import type { UserRepository } from '../repositories/UserRepository.js';
import type { UserSettingsRepository } from '../repositories/UserSettingsRepository.js';
import type { VideogameRepository } from '../repositories/VideogameRepository.js';

export interface SqliteRepositories {
  movies: MovieRepository;
  series: SeriesRepository;
  seasons: SeasonRepository;
  videogames: VideogameRepository;
  books: BookRepository;
  overrides: SeasonOverrideRepository;
  unlinked: UnlinkedTitleRepository;
  releaseAlerts: ReleaseAlertRepository;
  metadataStates: MetadataStateRepository;
  images: ImageRepository;
  users: UserRepository;
  settings: UserSettingsRepository;
  sessions: SessionRepository;
  apiTokens: ApiTokenRepository;
  transactions: TransactionRunner;
}
