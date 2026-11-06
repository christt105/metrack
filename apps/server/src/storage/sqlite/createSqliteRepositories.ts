import type { DatabaseSync } from 'node:sqlite';
import { SqliteBookRepository } from './SqliteBookRepository.js';
import { SqliteImageRepository } from './SqliteImageRepository.js';
import { SqliteMetadataStateRepository } from './SqliteMetadataStateRepository.js';
import { SqliteMovieRepository } from './SqliteMovieRepository.js';
import type { SqliteRepositories } from './SqliteRepositories.js';
import { SqliteReleaseAlertRepository } from './SqliteReleaseAlertRepository.js';
import { SqliteSeasonOverrideRepository } from './SqliteSeasonOverrideRepository.js';
import { SqliteSeasonRepository } from './SqliteSeasonRepository.js';
import { SqliteSeriesRepository } from './SqliteSeriesRepository.js';
import { SqliteTransactionRunner } from './SqliteTransactionRunner.js';
import { SqliteUnlinkedTitleRepository } from './SqliteUnlinkedTitleRepository.js';
import { SqliteVideogameRepository } from './SqliteVideogameRepository.js';

/** Every repository over one SQLite connection. */
export function createSqliteRepositories(db: DatabaseSync): SqliteRepositories {
  return {
    movies: new SqliteMovieRepository(db),
    series: new SqliteSeriesRepository(db),
    seasons: new SqliteSeasonRepository(db),
    videogames: new SqliteVideogameRepository(db),
    books: new SqliteBookRepository(db),
    overrides: new SqliteSeasonOverrideRepository(db),
    unlinked: new SqliteUnlinkedTitleRepository(db),
    releaseAlerts: new SqliteReleaseAlertRepository(db),
    metadataStates: new SqliteMetadataStateRepository(db),
    images: new SqliteImageRepository(db),
    transactions: new SqliteTransactionRunner(db),
  };
}
