import type { UserScope } from '../../users/UserScope.js';
import type { Repositories } from '../repositories/Repositories.js';
import type { D1Database } from './D1Database.js';
import { D1AccountRepository } from './D1AccountRepository.js';
import { D1ApiTokenRepository } from './D1ApiTokenRepository.js';
import { D1BookRepository } from './D1BookRepository.js';
import { D1HandAddedCatalogRepository } from './D1HandAddedCatalogRepository.js';
import { D1ImageRepository } from './D1ImageRepository.js';
import { D1MetadataStateRepository } from './D1MetadataStateRepository.js';
import { D1MovieRepository } from './D1MovieRepository.js';
import { D1PublicProfileRepository } from './D1PublicProfileRepository.js';
import { D1ReleaseAlertRepository } from './D1ReleaseAlertRepository.js';
import { D1SeasonOverrideRepository } from './D1SeasonOverrideRepository.js';
import { D1SeasonRepository } from './D1SeasonRepository.js';
import { D1SeriesRepository } from './D1SeriesRepository.js';
import { D1SessionRepository } from './D1SessionRepository.js';
import { D1TransactionRunner } from './D1TransactionRunner.js';
import { D1UnlinkedTitleRepository } from './D1UnlinkedTitleRepository.js';
import { D1UserRepository } from './D1UserRepository.js';
import { D1UserSettingsRepository } from './D1UserSettingsRepository.js';
import { D1VideogameRepository } from './D1VideogameRepository.js';

/** Every repository over one D1 database. Personal data is read and written as the user in scope. */
export function createD1Repositories(db: D1Database, scope: UserScope): Repositories {
  return {
    movies: new D1MovieRepository(db, scope),
    series: new D1SeriesRepository(db, scope),
    seasons: new D1SeasonRepository(db, scope),
    videogames: new D1VideogameRepository(db, scope),
    books: new D1BookRepository(db, scope),
    overrides: new D1SeasonOverrideRepository(db, scope),
    unlinked: new D1UnlinkedTitleRepository(db, scope),
    releaseAlerts: new D1ReleaseAlertRepository(db, scope),
    metadataStates: new D1MetadataStateRepository(db, scope),
    images: new D1ImageRepository(db),
    users: new D1UserRepository(db),
    settings: new D1UserSettingsRepository(db),
    profiles: new D1PublicProfileRepository(db),
    sessions: new D1SessionRepository(db),
    apiTokens: new D1ApiTokenRepository(db),
    accounts: new D1AccountRepository(db),
    handAddedCatalog: new D1HandAddedCatalogRepository(db),
    transactions: new D1TransactionRunner(),
  };
}
