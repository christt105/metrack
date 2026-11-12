import type { Logger } from '../notify/Logger.js';

/** Runs the usage monitor on a fixed tick, skipping a tick while the previous one is running. */
export class CloudflareUsageScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly monitor: { tick(): Promise<void> },
    private readonly logger: Logger,
  ) {}

  start(tickMs = 15 * 60 * 1000): void {
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
      await this.monitor.tick();
    } catch (error) {
      this.logger.error(
        `cloudflare usage monitor failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
    return true;
  }
}
