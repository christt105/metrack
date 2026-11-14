import { FailureAlert } from '../connector/FailureAlert.js';
import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type { CloudImageCleanup } from './CloudImageCleanup.js';
import type { CloudImageCleanupResult } from './CloudImageCleanupResult.js';
import { formatCloudImageCleanupResult } from './formatCloudImageCleanupResult.js';

/**
 * One run of the cloud image cleanup, logged. Failures are rethrown after counting them; after three in a row
 * the notifier is told once, and once more when a run works again.
 */
export class CloudImageCleanupJob {
  private failures = 0;
  private readonly alert: FailureAlert;

  constructor(
    private readonly cleanup: CloudImageCleanup,
    notifier: Notifier,
    private readonly logger: Logger,
  ) {
    this.alert = new FailureAlert(notifier, 'the cloud image cleanup');
  }

  /** Failures in a row so far. */
  get consecutiveFailures(): number {
    return this.failures;
  }

  async run(): Promise<CloudImageCleanupResult> {
    try {
      const result = await this.cleanup.run(true);
      this.logger.info(formatCloudImageCleanupResult(result));
      if (result.failed > 0) throw new Error(`${result.failed} image(s) could not be deleted`);
      this.failures = 0;
      await this.alert.recovered();
      return result;
    } catch (error) {
      this.failures += 1;
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`cloud image cleanup failed (attempt ${this.failures}): ${reason}`);
      await this.alert.failed(this.failures, reason);
      throw error;
    }
  }
}
