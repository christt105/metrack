import type { DatabaseSync } from 'node:sqlite';
import type { UserScope } from '../../users/UserScope.js';
import { SqliteAccountRepository } from './SqliteAccountRepository.js';
import { SqliteHandAddedCatalogRepository } from './SqliteHandAddedCatalogRepository.js';
import { SqliteApiTokenRepository } from './SqliteApiTokenRepository.js';
import { SqliteBookRepository } from './SqliteBookRepository.js';
import { SqliteImageRepository } from './SqliteImageRepository.js';
import { SqliteMetadataStateRepository } from './SqliteMetadataStateRepository.js';
import { SqliteMovieRepository } from './SqliteMovieRepository.js';
import type { SqliteRepositories } from './SqliteRepositories.js';
import { SqlitePublicProfileRepository } from './SqlitePublicProfileRepository.js';
import { SqliteReleaseAlertRepository } from './SqliteReleaseAlertRepository.js';
import { SqliteSeasonOverrideRepository } from './SqliteSeasonOverrideRepository.js';
import { SqliteSeasonRepository } from './SqliteSeasonRepository.js';
import { SqliteSessionRepository } from './SqliteSessionRepository.js';
import { SqliteSeriesRepository } from './SqliteSeriesRepository.js';
import { SqliteTransactionRunner } from './SqliteTransactionRunner.js';
import { SqliteUnlinkedTitleRepository } from './SqliteUnlinkedTitleRepository.js';
import { SqliteUserRepository } from './SqliteUserRepository.js';
import { SqliteUserSettingsRepository } from './SqliteUserSettingsRepository.js';
import { SqliteVideogameRepository } from './SqliteVideogameRepository.js';

/** Every repository over one SQLite connection. Personal data is read and written as the user in scope. */
export function createSqliteRepositories(db: DatabaseSync, scope: UserScope): SqliteRepositories {
  return {
    movies: new SqliteMovieRepository(db, scope),
    series: new SqliteSeriesRepository(db, scope),
    seasons: new SqliteSeasonRepository(db, scope),
    videogames: new SqliteVideogameRepository(db, scope),
    books: new SqliteBookRepository(db, scope),
    overrides: new SqliteSeasonOverrideRepository(db, scope),
    unlinked: new SqliteUnlinkedTitleRepository(db, scope),
    releaseAlerts: new SqliteReleaseAlertRepository(db, scope),
    metadataStates: new SqliteMetadataStateRepository(db, scope),
    images: new SqliteImageRepository(db),
    users: new SqliteUserRepository(db),
    settings: new SqliteUserSettingsRepository(db),
    profiles: new SqlitePublicProfileRepository(db),
    sessions: new SqliteSessionRepository(db),
    apiTokens: new SqliteApiTokenRepository(db),
    accounts: new SqliteAccountRepository(db),
    handAddedCatalog: new SqliteHandAddedCatalogRepository(db),
    transactions: new SqliteTransactionRunner(db),
  };
}
