import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { createHealthReport } from '@metrack/domain';
import type { MigrationRunner } from '../storage/MigrationRunner.js';

export interface AppDeps {
  appVersion: string;
  migrationRunner: MigrationRunner;
  webDir?: string;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.get('/api/health', async () =>
    createHealthReport(deps.appVersion, deps.migrationRunner.currentVersion()),
  );

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
