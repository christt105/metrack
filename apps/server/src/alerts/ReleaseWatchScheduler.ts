import type { Logger } from '../notify/Logger.js';
import type { ReleaseWatcher } from './ReleaseWatcher.js';

/** Runs the watcher on a fixed tick. The watcher decides which titles are actually due. */
export class ReleaseWatchScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly watcher: ReleaseWatcher,
    private readonly logger: Logger,
  ) {}

  start(tickMs = 10 * 60 * 1000): void {
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

  /** Runs one pass unless the previous one is still going. Returns whether a pass ran. */
  async tick(): Promise<boolean> {
    if (this.running) return false;
    this.running = true;
    try {
      await this.watcher.tick();
    } catch (error) {
      this.logger.error(
        `release watcher failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
    return true;
  }
}
