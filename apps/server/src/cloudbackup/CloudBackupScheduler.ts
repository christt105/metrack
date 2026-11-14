import { retryDelay } from '../connector/retryDelay.js';
import type { Scheduler } from '../publish/Scheduler.js';
import type { CloudBackup } from './CloudBackup.js';
import type { CloudBackupJob } from './CloudBackupJob.js';
import type { CloudBackupTime } from './CloudBackupTime.js';
import { nextDailyRun } from './nextDailyRun.js';

const DAY_MS = 24 * 3_600_000;
const CATCH_UP_DELAY_MS = 60_000;

/**
 * Runs the cloud backup every day at a local time. A failed run is retried after 1, 5, 15 and then every 60 minutes.
 * At start, when the newest copy is more than a day old (or there is none), it runs shortly instead of waiting for
 * the next daily time.
 */
export class CloudBackupScheduler {
  constructor(
    private readonly backup: CloudBackup,
    private readonly job: CloudBackupJob,
    private readonly time: CloudBackupTime,
    private readonly scheduler: Scheduler,
    private readonly now: () => Date = () => new Date(),
  ) {}

  start(): void {
    const newest = this.backup.newest();
    const stale = !newest || this.now().getTime() - newest.getTime() > DAY_MS;
    this.scheduler.schedule(() => void this.run(), stale ? CATCH_UP_DELAY_MS : this.untilNext());
  }

  private async run(): Promise<void> {
    let delay = this.untilNext();
    try {
      await this.job.run();
    } catch {
      delay = retryDelay(this.job.consecutiveFailures);
    }
    this.scheduler.schedule(() => void this.run(), delay);
  }

  private untilNext(): number {
    return nextDailyRun(this.now(), this.time);
  }
}
