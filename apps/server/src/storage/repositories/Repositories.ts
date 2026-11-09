import type { AccountRepository } from './AccountRepository.js';
import type { HandAddedCatalogRepository } from './HandAddedCatalogRepository.js';
import type { ApiTokenRepository } from './ApiTokenRepository.js';
import type { BookRepository } from './BookRepository.js';
import type { ImageRepository } from './ImageRepository.js';
import type { MetadataStateRepository } from './MetadataStateRepository.js';
import type { MovieRepository } from './MovieRepository.js';
import type { ReleaseAlertRepository } from './ReleaseAlertRepository.js';
import type { SeasonOverrideRepository } from './SeasonOverrideRepository.js';
import type { SeasonRepository } from './SeasonRepository.js';
import type { SessionRepository } from './SessionRepository.js';
import type { SeriesRepository } from './SeriesRepository.js';
import type { TransactionRunner } from './TransactionRunner.js';
import type { UnlinkedTitleRepository } from './UnlinkedTitleRepository.js';
import type { UserRepository } from './UserRepository.js';
import type { PublicProfileRepository } from './PublicProfileRepository.js';
import type { UserSettingsRepository } from './UserSettingsRepository.js';
import type { VideogameRepository } from './VideogameRepository.js';

export interface Repositories {
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
  profiles: PublicProfileRepository;
  sessions: SessionRepository;
  apiTokens: ApiTokenRepository;
  accounts: AccountRepository;
  handAddedCatalog: HandAddedCatalogRepository;
  transactions: TransactionRunner;
}
