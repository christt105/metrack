import type { FastifyInstance } from 'fastify';
import type { BackupJob } from '../backup/BackupJob.js';
import type { BackupService } from '../backup/BackupService.js';

export interface BackupRouteDeps {
  service: BackupService;
  job: BackupJob;
}

/** Registers the manual backup endpoints: list and create. */
export function registerBackupRoutes(app: FastifyInstance, deps: BackupRouteDeps): void {
  app.get('/api/backups', async () => deps.service.list());

  app.post('/api/backups', async (_request, reply) => {
    try {
      return reply.code(201).send(await deps.job.run());
    } catch (error) {
      return reply
        .code(500)
        .send({ error: error instanceof Error ? error.message : 'Backup failed' });
    }
  });
}
