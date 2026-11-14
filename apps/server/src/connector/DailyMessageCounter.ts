import type { Logger } from '../notify/Logger.js';
import type { ConnectorStateStore } from './ConnectorStateStore.js';

/**
 * Counts the alerts sent per UTC day in the connector's state file and refuses more once the limit is reached,
 * so the connector stops before ntfy.sh's limit of anonymous messages per IP. The count survives a restart.
 */
export class DailyMessageCounter {
  private warnedOn = '';

  constructor(
    private readonly store: ConnectorStateStore,
    private readonly limit: number,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Counts one message and resolves to true, or to false when today's limit is already used up. */
  take(): boolean {
    const day = this.now().toISOString().slice(0, 10);
    const state = this.store.read();
    const count = state.alertsSent.day === day ? state.alertsSent.count : 0;
    if (count >= this.limit) {
      if (this.warnedOn !== day) {
        this.warnedOn = day;
        this.logger.error(
          `release alerts: daily limit of ${this.limit} messages reached, the rest wait until tomorrow (UTC)`,
        );
      }
      return false;
    }
    this.store.write({ ...state, alertsSent: { day, count: count + 1 } });
    return true;
  }
}
