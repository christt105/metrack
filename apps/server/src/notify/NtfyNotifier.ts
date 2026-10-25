import type { Logger } from './Logger.js';
import type { NtfyConfig } from './NtfyConfig.js';
import type { Notifier } from './Notifier.js';
import type { NotifyOptions } from './NotifyOptions.js';

const PRIORITIES: Record<NonNullable<NotifyOptions['priority']>, number> = {
  low: 2,
  default: 3,
  high: 4,
};

/**
 * Publishes alerts to an ntfy topic as JSON to the server root, so titles and tags travel as UTF-8 in
 * the body and never in HTTP headers. Delivery failures are logged and reported, never thrown.
 */
export class NtfyNotifier implements Notifier {
  constructor(
    private readonly config: NtfyConfig,
    private readonly logger: Logger,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async notify(title: string, message: string, options: NotifyOptions = {}): Promise<boolean> {
    const payload = {
      topic: this.config.topic,
      title,
      message,
      priority: PRIORITIES[options.priority ?? 'high'],
      tags: options.tags ?? ['warning'],
      ...(options.imageUrl ? { attach: options.imageUrl } : {}),
    };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }
    const url = `${this.config.url.replace(/\/+$/, '')}/`;
    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        this.logger.error(`ntfy responded with status ${response.status}`);
      }
      return response.ok;
    } catch (error) {
      this.logger.error(`ntfy delivery failed: ${errorMessage(error)}`);
      return false;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
