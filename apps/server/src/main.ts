import { join } from 'node:path';
import { buildApp } from './api/buildApp.js';
import { loadConfig } from './config/loadConfig.js';
import { ImageStore } from './images/ImageStore.js';
import { LogNotifier } from './notify/LogNotifier.js';
import { MetadataCache } from './metadata/MetadataCache.js';
import { MetadataStateRepository } from './metadata/MetadataStateRepository.js';
import { movieLifecycle } from './metadata/movieLifecycle.js';
import { seriesLifecycle } from './metadata/seriesLifecycle.js';
import { CloudflarePagesPublisher } from './publish/CloudflarePagesPublisher.js';
import { FilePublishState } from './publish/FilePublishState.js';
import { loadPublishConfig } from './publish/loadPublishConfig.js';
import { NodeCommandRunner } from './publish/NodeCommandRunner.js';
import { PublishPipeline } from './publish/PublishPipeline.js';
import { PublishQueue } from './publish/PublishQueue.js';
import { TimerScheduler } from './publish/TimerScheduler.js';
import { TmdbClient } from './providers/tmdb/TmdbClient.js';
import { TmdbMovieSource } from './providers/tmdb/TmdbMovieSource.js';
import { TmdbSeriesSource } from './providers/tmdb/TmdbSeriesSource.js';
import { MigrationRunner } from './storage/MigrationRunner.js';
import { migrations } from './storage/migrations/index.js';
import { openDatabase } from './storage/openDatabase.js';
import {
  BookRepository,
  MovieRepository,
  SeasonRepository,
  SeriesRepository,
  VideogameRepository,
} from './storage/repositories/index.js';

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

const logger = { info: console.log, error: console.error };
const { config: publishConfig, missing: publishMissing } = loadPublishConfig(process.env);
let publishQueue: PublishQueue | undefined;
if (publishConfig) {
  const runner = new NodeCommandRunner();
  const pipeline = new PublishPipeline(
    {
      movies: new MovieRepository(db),
      series: new SeriesRepository(db),
      seasons: new SeasonRepository(db),
      videogames: new VideogameRepository(db),
      books: new BookRepository(db),
      images: imageStore,
    },
    {
      siteTemplateDir: publishConfig.siteTemplateDir,
      workDir: join(config.dataDir, 'publish'),
      hugoBinary: publishConfig.hugoBinary,
    },
    runner,
    new CloudflarePagesPublisher(publishConfig, runner),
    new FilePublishState(join(config.dataDir, 'publish-state.json')),
  );
  publishQueue = new PublishQueue(
    () => pipeline.run(),
    new LogNotifier(logger),
    logger,
    new TimerScheduler(),
  );
} else {
  console.log(`Publishing is disabled, missing: ${publishMissing.join(', ')}`);
}

const app = await buildApp({
  appVersion: config.appVersion,
  migrationRunner,
  webDir: config.webDir,
  imageStore,
  metadataCache,
  publishQueue,
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
