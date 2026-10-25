import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { ImageStore } from '../images/ImageStore.js';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { openDatabase } from '../storage/openDatabase.js';
import {
  BookRepository,
  MovieRepository,
  SeasonRepository,
  SeriesRepository,
  VideogameRepository,
} from '../storage/repositories/index.js';
import type { ExportSources } from './loadExportInput.js';

/** Opens the database and image store in a data directory with the repositories the exporter reads. */
export function openExportSources(dataDir: string): { db: DatabaseSync; sources: ExportSources } {
  const db = openDatabase(join(dataDir, 'metrack.db'));
  new MigrationRunner(db, migrations).run();
  return {
    db,
    sources: {
      movies: new MovieRepository(db),
      series: new SeriesRepository(db),
      seasons: new SeasonRepository(db),
      videogames: new VideogameRepository(db),
      books: new BookRepository(db),
      images: new ImageStore(db, join(dataDir, 'images')),
    },
  };
}
