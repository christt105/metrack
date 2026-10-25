import type { Logger } from '../notify/Logger.js';
import type { BackupJob } from './BackupJob.js';
import type { BackupService } from './BackupService.js';

/** Starts a backup whenever the newest one is older than the interval, checked on a fixed tick. */
export class BackupScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly service: BackupService,
    private readonly job: BackupJob,
    private readonly intervalMs: number,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
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
    } catch {
      this.logger.error('scheduled backup failed; will retry on the next tick');
    } finally {
      this.running = false;
    }
    return true;
  }

  private isDue(): boolean {
    const newest = this.service.list()[0];
    if (!newest) {
      return true;
    }
    return this.now().getTime() - Date.parse(newest.createdAt) >= this.intervalMs;
  }
}
