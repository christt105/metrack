import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type { Scheduler } from '../publish/Scheduler.js';
import { CloudClient } from './CloudClient.js';
import { ConnectorQueue } from './ConnectorQueue.js';
import { ConnectorStateStore } from './ConnectorStateStore.js';
import { FailureAlert } from './FailureAlert.js';
import { retryDelay } from './retryDelay.js';

/**
 * Asks the cloud who has a Jellyfin account and queues a sync for each of them, now and then every `intervalMs`, in
 * case a webhook was lost. When the cloud cannot be reached it tries again after 1, 5, 15 and then every 60 minutes,
 * and reports a run of failures once.
 */
export class FullPass {
  private failures = 0;
  private readonly alert: FailureAlert;

  constructor(
    private readonly cloud: CloudClient,
    private readonly queue: ConnectorQueue,
    private readonly store: ConnectorStateStore,
    notifier: Notifier,
    private readonly logger: Logger,
    private readonly scheduler: Scheduler,
    private readonly intervalMs: number,
  ) {
    this.alert = new FailureAlert(notifier, 'the pass over every user');
  }

  /** The users seen by the last pass. */
  knownUsers(): number[] {
    return this.store.read().users;
  }

  /** Reads who has a Jellyfin account and queues a sync for each. Fails when the cloud cannot be reached. */
  async queueUsers(): Promise<number[]> {
    const ids = (await this.cloud.users()).map((user) => user.id);
    this.store.write({ ...this.store.read(), users: ids });
    this.queue.markAll(ids);
    this.logger.info(`Full pass queued ${ids.length} users`);
    return ids;
  }

  /** Queues every user, then schedules the next pass: after the interval, or sooner when this one failed. */
  async run(): Promise<void> {
    let delay = this.intervalMs;
    try {
      await this.queueUsers();
      this.failures = 0;
      await this.alert.recovered();
    } catch (error) {
      this.failures += 1;
      delay = retryDelay(this.failures);
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Full pass failed (attempt ${this.failures}): ${reason}`);
      await this.alert.failed(this.failures, reason);
    }
    this.scheduler.schedule(() => void this.run(), delay);
  }
}
