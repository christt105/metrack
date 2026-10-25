import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type { BackupInfo } from './BackupInfo.js';
import type { BackupService } from './BackupService.js';

/** Runs one backup followed by retention pruning, alerting through the notifier on failure. */
export class BackupJob {
  constructor(
    private readonly service: BackupService,
    private readonly retention: number,
    private readonly notifier: Notifier,
    private readonly logger: Logger,
  ) {}

  /** Returns the new backup, or throws after having sent the alert. */
  async run(): Promise<BackupInfo> {
    try {
      const info = this.service.create();
      const removed = this.service.prune(this.retention);
      this.logger.info(`backup ${info.name} created, ${removed.length} old backup(s) pruned`);
      return info;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`backup failed: ${message}`);
      await this.notifier.notify('metrack backup failed', message);
      throw error;
    }
  }
}
