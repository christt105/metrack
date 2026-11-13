import type { Notifier } from '../notify/Notifier.js';

export const ALERT_AFTER_FAILURES = 3;

/**
 * Tells the notifier once when something has failed `ALERT_AFTER_FAILURES` times in a row, retrying the alert on
 * later failures until it is delivered, and once more when it works again.
 */
export class FailureAlert {
  private alerted = false;

  constructor(
    private readonly notifier: Notifier,
    private readonly label: string,
  ) {}

  async failed(failures: number, reason: string): Promise<void> {
    if (this.alerted || failures < ALERT_AFTER_FAILURES) return;
    this.alerted = await this.notifier.notify(
      `metrack connector: ${this.label} failed`,
      `${failures} attempts in a row failed, the last one with: ${reason}`,
    );
  }

  async recovered(): Promise<void> {
    if (!this.alerted) return;
    this.alerted = false;
    await this.notifier.notify(`metrack connector: ${this.label} recovered`, 'It works again.', {
      priority: 'default',
      tags: ['white_check_mark'],
    });
  }
}
