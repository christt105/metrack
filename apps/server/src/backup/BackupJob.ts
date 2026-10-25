import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type { BackupInfo } from './BackupInfo.js';
import type { BackupService } from './BackupService.js';

/**
 * Runs one backup followed by retention pruning. Alerts through the notifier on the first failure
 * of a streak only (retrying on later failures until the alert is delivered), and once more when a
 * backup succeeds again.
 */
export class BackupJob {
  private failing = false;

  constructor(
    private readonly service: BackupService,
    private readonly retention: number,
    private readonly notifier: Notifier,
    private readonly logger: Logger,
  ) {}

  /** Returns the new backup, or rethrows the failure after logging it. */
  async run(): Promise<BackupInfo> {
    let info: BackupInfo;
    try {
      info = this.service.create();
      const removed = this.service.prune(this.retention);
      this.logger.info(`backup ${info.name} created, ${removed.length} old backup(s) pruned`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`backup failed: ${message}`);
      if (!this.failing) {
        this.failing = await this.notifier.notify('metrack backup failed', message);
      }
      throw error;
    }
    if (this.failing) {
      this.failing = false;
      await this.notifier.notify('metrack backup recovered', `backup ${info.name} created`, {
        priority: 'default',
        tags: ['white_check_mark'],
      });
    }
    return info;
  }
}
