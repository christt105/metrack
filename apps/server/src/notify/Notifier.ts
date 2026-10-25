import type { NotifyOptions } from './NotifyOptions.js';

/** Delivers a notification to a human. Implementations must not throw. */
export interface Notifier {
  /** Resolves to whether the notification was delivered. */
  notify(title: string, message: string, options?: NotifyOptions): Promise<boolean>;
}
