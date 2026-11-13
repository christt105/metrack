import type { ScheduledTickDeps } from './ScheduledTickDeps.js';

/** The most accounts one tick erases, to stay far from the subrequest limit of an invocation. */
export const ERASE_ACCOUNTS_PER_TICK = 1;

/**
 * What one cron trigger does: erase at most one due account. A failure is logged and never rejects, so a
 * bad account cannot make the invocation fail.
 */
export class ScheduledTick {
  constructor(private readonly deps: ScheduledTickDeps) {}

  async run(scheduledTime: number): Promise<void> {
    const now = new Date(scheduledTime);
    const { logger } = this.deps;
    let erased: number[] = [];
    try {
      erased = await this.deps.accounts.eraseDue(ERASE_ACCOUNTS_PER_TICK);
    } catch (error) {
      logger.error(
        `account erasing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    logger.info(`scheduled tick ${now.toISOString()}: erased=${erased.length}`);
  }
}
