import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
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
 * backoff. A run of failures is reported once through the notifier (retrying the alert on later
 * failures until it is delivered), and once more when a publish succeeds again.
 */
export class PublishQueue {
  private dirty = false;
  private running = false;
  private waiting = false;
  private failures = 0;
  private alerted = false;

  constructor(
    private readonly attempt: () => Promise<string>,
    private readonly notifier: Notifier,
    private readonly logger: Logger,
    private readonly scheduler: Scheduler,
    private readonly options: PublishQueueOptions = DEFAULT_QUEUE_OPTIONS,
  ) {}

  private get label(): string {
    return this.options.label ?? 'publish';
  }

  private get title(): string {
    return this.label.charAt(0).toUpperCase() + this.label.slice(1);
  }

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
      this.logger.info(`${this.title} ${outcome}`);
      if (this.alerted) {
        this.alerted = false;
        await this.notifier.notify(`metrack ${this.label} recovered`, `${this.title} ${outcome}`, {
          priority: 'default',
          tags: ['white_check_mark'],
        });
      }
    } catch (error) {
      this.failures += 1;
      this.dirty = true;
      const reason = error instanceof Error ? error.message : String(error);
      const delay = Math.min(
        this.options.baseDelayMs * 2 ** (this.failures - 1),
        this.options.maxDelayMs,
      );
      this.logger.error(`${this.title} failed (attempt ${this.failures}): ${reason}`);
      if (!this.alerted) {
        this.alerted = await this.notifier.notify(
          `metrack ${this.label} failed`,
          `Attempt ${this.failures} failed: ${reason}. Retrying in ${Math.round(delay / 1000)}s.`,
        );
      }
      this.running = false;
      this.wait(delay);
      return;
    }
    this.running = false;
    if (this.dirty) this.wait(this.options.debounceMs);
  }
}
