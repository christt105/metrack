import type { Logger } from '../notify/Logger.js';
import type { SeasonCacheJob } from './SeasonCacheJob.js';

/** Runs the season cache check once at start and then on a fixed tick. */
export class SeasonCacheScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly job: SeasonCacheJob,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  start(tickMs = 60 * 60 * 1000): void {
    if (this.timer) return;
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

  /** Runs one pass unless one is still going; answers how many season entries differ. */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.job.run(this.now());
    } catch (error) {
      this.logger.error(
        `season cache check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
