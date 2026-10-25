import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { createHealthReport } from '@metrack/domain';
import { registerArtworkRoutes } from './registerArtworkRoutes.js';
import { registerErrorHandler } from './registerErrorHandler.js';
import { registerImageRoutes } from './registerImageRoutes.js';
import { registerMetadataRoutes } from './registerMetadataRoutes.js';
import { registerMediaRoutes } from './registerMediaRoutes.js';
import { registerPublishRoutes } from './registerPublishRoutes.js';
import { registerSeasonOverrideRoutes } from './registerSeasonOverrideRoutes.js';
import { registerSyncRoutes } from './registerSyncRoutes.js';
import { registerTitleRoutes } from './registerTitleRoutes.js';
import type { EditServices } from './EditServices.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import type { PublishQueue } from '../publish/PublishQueue.js';
import { registerBackupRoutes } from './registerBackupRoutes.js';
import type { BackupJob } from '../backup/BackupJob.js';
import type { BackupService } from '../backup/BackupService.js';
import type { SyncService } from '../sync/SyncService.js';
import type { MigrationRunner } from '../storage/MigrationRunner.js';

export interface AppDeps {
  appVersion: string;
  migrationRunner: MigrationRunner;
  webDir?: string;
  imageStore?: ImageStore;
  metadataCache?: MetadataCache;
  publishQueue?: PublishQueue;
  edit?: EditServices;
  backup?: { service: BackupService; job: BackupJob };
  sync?: SyncService;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: 'array' } },
  });
  registerErrorHandler(app);

  app.get('/api/health', async () =>
    createHealthReport(deps.appVersion, deps.migrationRunner.currentVersion()),
  );

  if (deps.imageStore) registerImageRoutes(app, deps.imageStore);
  if (deps.metadataCache) registerMetadataRoutes(app, deps.metadataCache, deps.edit?.editor);
  if (deps.edit) {
    const { editor, catalog, artwork, titleProviders, unlinked, resolver, series, overrides } =
      deps.edit;
    registerMediaRoutes(app, editor, catalog);
    registerSeasonOverrideRoutes(app, series, overrides);
    registerArtworkRoutes(app, artwork, editor);
    registerTitleRoutes(app, titleProviders, unlinked, resolver);
  }
  registerSyncRoutes(app, deps.sync);
  if (deps.backup) registerBackupRoutes(app, deps.backup);
  if (deps.publishQueue) registerPublishRoutes(app, deps.publishQueue);

  const webDir = deps.webDir ? resolve(deps.webDir) : undefined;
  const serveWeb = webDir !== undefined && existsSync(webDir);
  if (serveWeb) await app.register(fastifyStatic, { root: webDir });
  app.setNotFoundHandler((request, reply) => {
    if (serveWeb && request.method === 'GET' && !request.url.startsWith('/api/')) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Not found', code: 'not_found' });
  });

  return app;
}
