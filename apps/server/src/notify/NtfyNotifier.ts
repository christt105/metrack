import type { Logger } from './Logger.js';
import type { NtfyConfig } from './NtfyConfig.js';
import type { Notifier } from './Notifier.js';
import type { NotifyOptions } from './NotifyOptions.js';

/** Publishes alerts to an ntfy topic. Delivery failures are logged, never thrown. */
export class NtfyNotifier implements Notifier {
  constructor(
    private readonly config: NtfyConfig,
    private readonly logger: Logger,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async notify(title: string, message: string, options: NotifyOptions = {}): Promise<void> {
    const headers: Record<string, string> = {
      Title: encodeHeader(title),
      Priority: options.priority ?? 'high',
      Tags: (options.tags ?? ['warning']).join(','),
    };
    if (options.imageUrl) {
      headers.Attach = options.imageUrl;
    }
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

/** HTTP header values are Latin-1; anything else is sent as an RFC 2047 encoded word, which ntfy decodes. */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e\xa0-\xff]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}
