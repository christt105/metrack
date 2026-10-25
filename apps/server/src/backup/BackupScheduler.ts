import type { Logger } from '../notify/Logger.js';
import type { BackupJob } from './BackupJob.js';
import type { BackupService } from './BackupService.js';

/**
 * Starts a backup whenever the newest one is older than the interval, checked on a fixed tick.
 * After a failure the next attempt waits `retryBaseMs`, doubling on each consecutive failure and
 * capped at the backup interval.
 */
export class BackupScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private failures = 0;
  private retryAt: number | undefined;

  constructor(
    private readonly service: BackupService,
    private readonly job: BackupJob,
    private readonly intervalMs: number,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
    private readonly retryBaseMs = 10 * 60 * 1000,
  ) {}

  start(tickMs = 10 * 60 * 1000): void {
    if (this.timer) {
      return;
    }
    void this.tick();
    this.timer = setInterval(() => void this.tick(), tickMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Runs a backup if one is due. Returns true when a backup was attempted. */
  async tick(): Promise<boolean> {
    if (this.running || !this.isDue()) {
      return false;
    }
    this.running = true;
    try {
      await this.job.run();
      this.failures = 0;
      this.retryAt = undefined;
    } catch {
      this.failures += 1;
      const delay = Math.min(this.retryBaseMs * 2 ** (this.failures - 1), this.intervalMs);
      this.retryAt = this.now().getTime() + delay;
      this.logger.error(
        `scheduled backup failed (${this.failures} in a row); next attempt at ${new Date(this.retryAt).toISOString()}`,
      );
    } finally {
      this.running = false;
    }
    return true;
  }

  private isDue(): boolean {
    const now = this.now().getTime();
    if (this.retryAt !== undefined && now < this.retryAt) {
      return false;
    }
    const newest = this.service.list()[0];
    if (!newest) {
      return true;
    }
    return now - Date.parse(newest.createdAt) >= this.intervalMs;
  }
}
