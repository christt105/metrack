import type { NotifyOptions } from './NotifyOptions.js';

/** Delivers a notification to a human. Implementations must not throw. */
export interface Notifier {
  notify(title: string, message: string, options?: NotifyOptions): Promise<void>;
}
