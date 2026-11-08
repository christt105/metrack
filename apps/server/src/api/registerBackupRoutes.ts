import type { ApiRoutes } from './ApiRoutes.js';
import { jsonResponse } from './jsonResponse.js';
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
export function registerBackupRoutes(routes: ApiRoutes, deps: BackupRouteDeps): void {
  routes.get('/api/backups', { config: { ownerOnly: true } }, async () => deps.service.list());

  routes.post('/api/backups', { config: { ownerOnly: true } }, async () => {
    try {
      return jsonResponse(await deps.job.run(), 201);
    } catch {
      return jsonResponse({ error: 'Backup failed', code: 'backup_failed' }, 500);
    }
  });
}
