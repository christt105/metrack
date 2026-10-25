import type { Notifier } from '../../src/notify/Notifier.js';
import type { NotifyOptions } from '../../src/notify/NotifyOptions.js';

export interface SentNotification {
  title: string;
  message: string;
  options: NotifyOptions | undefined;
}

export class RecordingNotifier implements Notifier {
  readonly sent: SentNotification[] = [];

  async notify(title: string, message: string, options?: NotifyOptions): Promise<void> {
    this.sent.push({ title, message, options });
  }
}
