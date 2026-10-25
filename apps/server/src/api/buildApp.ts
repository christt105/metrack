import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { createHealthReport } from '@metrack/domain';
import { registerImageRoutes } from './registerImageRoutes.js';
import { registerMetadataRoutes } from './registerMetadataRoutes.js';
import { registerPublishRoutes } from './registerPublishRoutes.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import type { PublishQueue } from '../publish/PublishQueue.js';
import { registerBackupRoutes } from './registerBackupRoutes.js';
import type { BackupJob } from '../backup/BackupJob.js';
import type { BackupService } from '../backup/BackupService.js';
import type { MigrationRunner } from '../storage/MigrationRunner.js';

export interface AppDeps {
  appVersion: string;
  migrationRunner: MigrationRunner;
  webDir?: string;
  imageStore?: ImageStore;
  metadataCache?: MetadataCache;
  publishQueue?: PublishQueue;
  backup?: { service: BackupService; job: BackupJob };
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.get('/api/health', async () =>
    createHealthReport(deps.appVersion, deps.migrationRunner.currentVersion()),
  );

  if (deps.imageStore) registerImageRoutes(app, deps.imageStore);
  if (deps.metadataCache) registerMetadataRoutes(app, deps.metadataCache);
  if (deps.publishQueue) registerPublishRoutes(app, deps.publishQueue);
  if (deps.backup) {
    registerBackupRoutes(app, deps.backup);
  }

  const webDir = deps.webDir ? resolve(deps.webDir) : undefined;
  if (webDir && existsSync(webDir)) {
    await app.register(fastifyStatic, { root: webDir });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'Not found' });
    });
  }

  return app;
}
