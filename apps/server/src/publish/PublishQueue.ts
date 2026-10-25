import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type { PublishOutcome } from './PublishOutcome.js';
import type { PublishQueueOptions } from './PublishQueueOptions.js';
import type { Scheduler } from './Scheduler.js';

export const DEFAULT_QUEUE_OPTIONS: PublishQueueOptions = {
  debounceMs: 5_000,
  baseDelayMs: 60_000,
  maxDelayMs: 3_600_000,
};

/**
 * Publishes when something changed, never on a clock. Changes are coalesced, a change that arrives
 * during a publish triggers another one afterwards, and failures are retried with exponential
 * backoff while telling a human through the notifier.
 */
export class PublishQueue {
  private dirty = false;
  private running = false;
  private waiting = false;
  private failures = 0;

  constructor(
    private readonly attempt: () => Promise<PublishOutcome>,
    private readonly notifier: Notifier,
    private readonly logger: Logger,
    private readonly scheduler: Scheduler,
    private readonly options: PublishQueueOptions = DEFAULT_QUEUE_OPTIONS,
  ) {}

  /** Records that the published site may be out of date. */
  markDirty(): void {
    this.dirty = true;
    if (!this.running && !this.waiting) this.wait(this.options.debounceMs);
  }

  /** Consecutive failed attempts so far. */
  failureCount(): number {
    return this.failures;
  }

  private wait(delayMs: number): void {
    this.waiting = true;
    this.scheduler.schedule(() => {
      this.waiting = false;
      void this.run();
    }, delayMs);
  }

  private async run(): Promise<void> {
    this.running = true;
    this.dirty = false;
    try {
      const outcome = await this.attempt();
      this.failures = 0;
      this.logger.info(`Publish ${outcome}`);
    } catch (error) {
      this.failures += 1;
      this.dirty = true;
      const reason = error instanceof Error ? error.message : String(error);
      const delay = Math.min(
        this.options.baseDelayMs * 2 ** (this.failures - 1),
        this.options.maxDelayMs,
      );
      this.logger.error(`Publish failed (attempt ${this.failures}): ${reason}`);
      await this.notifier.notify(
        'metrack publish failed',
        `Attempt ${this.failures} failed: ${reason}. Retrying in ${Math.round(delay / 1000)}s.`,
      );
      this.running = false;
      this.wait(delay);
      return;
    }
    this.running = false;
    if (this.dirty) this.wait(this.options.debounceMs);
  }
}
