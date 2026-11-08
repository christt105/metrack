import type { Logger } from '../notify/Logger.js';
import type { AccountDeletionService } from './AccountDeletionService.js';

/** Erases the accounts whose deletion is due, once at start and then on a fixed tick. */
export class AccountDeletionScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly service: AccountDeletionService,
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

  /** Runs one pass unless one is still going; answers the ids erased. */
  async tick(): Promise<number[]> {
    if (this.running) return [];
    this.running = true;
    try {
      return await this.service.eraseDue();
    } catch (error) {
      this.logger.error(
        `account deletion pass failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    } finally {
      this.running = false;
    }
  }
}
