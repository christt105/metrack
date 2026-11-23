import type { ScheduledTickDeps } from './ScheduledTickDeps.js';

/** The most accounts one tick erases, to stay far from the subrequest limit of an invocation. */
export const ERASE_ACCOUNTS_PER_TICK = 1;

/** The subrequests the tick may spend on game artwork, kept below the invocation limit for what runs before it. */
export const TICK_ARTWORK_BUDGET = 30;

/**
 * What one cron trigger does: erase at most one due account and fill in the running time of a few movies and, only when none of that was needed, the artwork of a few games or, when there was none to do, check a few series for season entries that differ from their episodes (report only). A failure is logged and never rejects, so a
 * bad account cannot make the invocation fail.
 */
export class ScheduledTick {
  constructor(private readonly deps: ScheduledTickDeps) {}

  async run(scheduledTime: number): Promise<void> {
    const now = new Date(scheduledTime);
    const { logger } = this.deps;
    let erased: number[] = [];
    let idle = true;
    try {
      erased = await this.deps.accounts.eraseDue(ERASE_ACCOUNTS_PER_TICK);
    } catch (error) {
      idle = false;
      logger.error(
        `account erasing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    let runtimes: number | undefined;
    try {
      runtimes = await this.deps.runtimes?.runBatch();
    } catch (error) {
      idle = false;
      logger.error(
        `movie runtime backfill failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    let artwork: number | undefined;
    try {
      if (idle && erased.length === 0 && !runtimes) {
        artwork = await this.deps.artwork?.runBatch({ budget: TICK_ARTWORK_BUDGET });
      }
    } catch (error) {
      logger.error(
        `game artwork backfill failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    let differing: number | undefined;
    try {
      if (idle && erased.length === 0 && !runtimes && !artwork) {
        differing = await this.deps.seasonCache?.run(now);
      }
    } catch (error) {
      logger.error(
        `season cache check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    logger.info(
      `scheduled tick ${now.toISOString()}: erased=${erased.length}${runtimes === undefined ? '' : ` runtimes=${runtimes}`}${artwork === undefined ? '' : ` artwork=${artwork}`}${differing === undefined ? '' : ` seasonCacheDiffers=${differing}`}`,
    );
  }
}
