import type { FetchFn } from '../http/FetchFn.js';
import type { Logger } from '../notify/Logger.js';
import { NtfyNotifier } from '../notify/NtfyNotifier.js';
import type { Notifier } from '../notify/Notifier.js';
import type { NotifyOptions } from '../notify/NotifyOptions.js';
import type { DailyMessageCounter } from './DailyMessageCounter.js';

/**
 * Publishes one user's release alerts to their ntfy topic on the shared server, counting each message against the
 * daily limit. Without budget left, or when the topic cannot be read, the alert is reported as not delivered so it
 * stays pending.
 */
export class ReleaseAlertNotifier implements Notifier {
  constructor(
    private readonly topic: () => Promise<string>,
    private readonly ntfyUrl: string,
    private readonly counter: DailyMessageCounter,
    private readonly logger: Logger,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async notify(title: string, message: string, options?: NotifyOptions): Promise<boolean> {
    let topic: string;
    try {
      topic = await this.topic();
    } catch (error) {
      this.logger.error(
        `release alerts: reading the ntfy topic failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
    if (!this.counter.take()) return false;
    return new NtfyNotifier({ url: this.ntfyUrl, topic }, this.logger, this.fetchFn).notify(
      title,
      message,
      options,
    );
  }
}
