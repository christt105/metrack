import type { Config } from '../config/Config.js';
import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import { BackupCopier } from './BackupCopier.js';
import { BackupJob } from './BackupJob.js';
import type { BackupService } from './BackupService.js';

/** Builds the backup job, copying each backup to BACKUP_COPY_DIR when it is set. */
export function createBackupJob(
  config: Config,
  service: BackupService,
  notifier: Notifier,
  logger: Logger,
): BackupJob {
  const copier = config.backup.copy
    ? new BackupCopier(service, config.backup.dir, config.backup.copy)
    : undefined;
  return new BackupJob(service, config.backup.retention, notifier, logger, copier);
}
