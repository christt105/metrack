import { FailureAlert } from '../connector/FailureAlert.js';
import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type { CloudBackup } from './CloudBackup.js';
import type { CloudBackupResult } from './CloudBackupResult.js';
import { formatCloudBackupResult } from './formatCloudBackupResult.js';

/**
 * One run of the cloud backup, logged. Failures are rethrown after counting them; after three in a row the notifier
 * is told once, and once more when a run works again.
 */
export class CloudBackupJob {
  private failures = 0;
  private readonly alert: FailureAlert;

  constructor(
    private readonly backup: CloudBackup,
    notifier: Notifier,
    private readonly logger: Logger,
  ) {
    this.alert = new FailureAlert(notifier, 'the cloud backup');
  }

  /** Failures in a row so far. */
  get consecutiveFailures(): number {
    return this.failures;
  }

  async run(): Promise<CloudBackupResult> {
    try {
      const result = await this.backup.run();
      this.logger.info(formatCloudBackupResult(result));
      this.failures = 0;
      await this.alert.recovered();
      return result;
    } catch (error) {
      this.failures += 1;
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`cloud backup failed (attempt ${this.failures}): ${reason}`);
      await this.alert.failed(this.failures, reason);
      throw error;
    }
  }
}
