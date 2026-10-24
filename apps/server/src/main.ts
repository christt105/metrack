import { join } from 'node:path';
import { buildApp } from './api/buildApp.js';
import { loadConfig } from './config/loadConfig.js';
import { ImageStore } from './images/ImageStore.js';
import { MetadataCache } from './metadata/MetadataCache.js';
import { MetadataStateRepository } from './metadata/MetadataStateRepository.js';
import { movieLifecycle } from './metadata/movieLifecycle.js';
import { seriesLifecycle } from './metadata/seriesLifecycle.js';
import { TmdbClient } from './providers/tmdb/TmdbClient.js';
import { TmdbMovieSource } from './providers/tmdb/TmdbMovieSource.js';
import { TmdbSeriesSource } from './providers/tmdb/TmdbSeriesSource.js';
import { MigrationRunner } from './storage/MigrationRunner.js';
import { migrations } from './storage/migrations/index.js';
import { openDatabase } from './storage/openDatabase.js';
import { MovieRepository, SeriesRepository } from './storage/repositories/index.js';

const config = loadConfig(process.env);
const db = openDatabase(join(config.dataDir, 'metrack.db'));
const migrationRunner = new MigrationRunner(db, migrations);
const schemaVersion = migrationRunner.run();

const imageStore = new ImageStore(db, join(config.dataDir, 'images'));
const metadataCache = new MetadataCache(new MetadataStateRepository(db), imageStore);
if (config.tmdbApiKey) {
  const tmdb = new TmdbClient(fetch, { apiKey: config.tmdbApiKey, language: config.tmdbLanguage });
  metadataCache.register('movie', {
    repository: new MovieRepository(db),
    source: new TmdbMovieSource(tmdb),
    lifecycle: movieLifecycle,
  });
  metadataCache.register('series', {
    repository: new SeriesRepository(db),
    source: new TmdbSeriesSource(tmdb),
    lifecycle: seriesLifecycle,
  });
}

const app = await buildApp({
  appVersion: config.appVersion,
  migrationRunner,
  webDir: config.webDir,
  imageStore,
  metadataCache,
});

const shutdown = async (): Promise<void> => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.port, host: config.host });
console.log(`metrack listening on ${config.host}:${config.port} (schema v${schemaVersion})`);
