import type { Logger } from './Logger.js';
import type { Notifier } from './Notifier.js';

/** Fallback notifier that only writes the alert to the log, which always counts as delivered. */
export class LogNotifier implements Notifier {
  constructor(private readonly logger: Logger) {}

  async notify(title: string, message: string): Promise<boolean> {
    this.logger.error(`[alert] ${title}: ${message}`);
    return true;
  }
}
