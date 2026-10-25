import type { FastifyInstance } from 'fastify';
import type { BackupJob } from '../backup/BackupJob.js';
import type { BackupService } from '../backup/BackupService.js';

export interface BackupRouteDeps {
  service: BackupService;
  job: BackupJob;
}

/**
 * Registers the manual backup endpoints: list and create. The job logs a failure in full; the client
 * only gets a generic error so filesystem details are not exposed.
 */
export function registerBackupRoutes(app: FastifyInstance, deps: BackupRouteDeps): void {
  app.get('/api/backups', async () => deps.service.list());

  app.post('/api/backups', async (_request, reply) => {
    try {
      return reply.code(201).send(await deps.job.run());
    } catch {
      return reply.code(500).send({ error: 'Backup failed', code: 'backup_failed' });
    }
  });
}
