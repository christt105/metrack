import type { Logger } from './Logger.js';
import type { NtfyConfig } from './NtfyConfig.js';
import type { Notifier } from './Notifier.js';

/** Publishes alerts to an ntfy topic. Delivery failures are logged, never thrown. */
export class NtfyNotifier implements Notifier {
  constructor(
    private readonly config: NtfyConfig,
    private readonly logger: Logger,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async notify(title: string, message: string): Promise<void> {
    const headers: Record<string, string> = { Title: title, Priority: 'high', Tags: 'warning' };
    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }
    const url = `${this.config.url.replace(/\/+$/, '')}/${encodeURIComponent(this.config.topic)}`;
    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers,
        body: message,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        this.logger.error(`ntfy responded with status ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`ntfy delivery failed: ${errorMessage(error)}`);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
