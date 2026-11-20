import type { Logger } from '../notify/Logger.js';
import type { GameArtworkBackfill } from './GameArtworkBackfill.js';

/** There is no subrequest limit at home, so a tick prepares many games at once. */
const HOME_BUDGET = 400;

/** Runs one game artwork batch at start and then on a fixed tick, finishing what the Steam import left pending. */
export class GameArtworkScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly backfill: GameArtworkBackfill,
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

  /** Runs one batch unless one is still going; answers how many games it finished. */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.backfill.runBatch({ budget: HOME_BUDGET });
    } catch (error) {
      this.logger.error(
        `game artwork backfill failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
