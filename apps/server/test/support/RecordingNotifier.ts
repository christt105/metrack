import type { Notifier } from '../../src/notify/Notifier.js';
import type { NotifyOptions } from '../../src/notify/NotifyOptions.js';

export interface SentNotification {
  title: string;
  message: string;
  options: NotifyOptions | undefined;
}

export class RecordingNotifier implements Notifier {
  readonly sent: SentNotification[] = [];
  readonly failed: SentNotification[] = [];
  /** Decides which notifications fail to be delivered, as if ntfy were unreachable. */
  fails: (notification: SentNotification) => boolean = () => false;

  async notify(title: string, message: string, options?: NotifyOptions): Promise<boolean> {
    const notification = { title, message, options };
    if (this.fails(notification)) {
      this.failed.push(notification);
      return false;
    }
    this.sent.push(notification);
    return true;
  }
}
