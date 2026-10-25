import type { NtfyConfig } from './NtfyConfig.js';
import type { Logger } from './Logger.js';
import { LogNotifier } from './LogNotifier.js';
import { NtfyNotifier } from './NtfyNotifier.js';
import type { Notifier } from './Notifier.js';

/** Uses ntfy when configured, otherwise only logs alerts. */
export function createNotifier(ntfy: NtfyConfig | undefined, logger: Logger): Notifier {
  return ntfy ? new NtfyNotifier(ntfy, logger) : new LogNotifier(logger);
}
