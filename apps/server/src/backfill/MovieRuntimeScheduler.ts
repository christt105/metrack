import type { Logger } from '../notify/Logger.js';
import type { MovieRuntimeBackfill } from './MovieRuntimeBackfill.js';

/** Runs one runtime backfill batch at start and then on a fixed tick. */
export class MovieRuntimeScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly backfill: MovieRuntimeBackfill,
    private readonly logger: Logger,
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

  /** Runs one batch unless one is still going; answers how many movies it filled in. */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.backfill.runBatch();
    } catch (error) {
      this.logger.error(
        `movie runtime backfill failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
