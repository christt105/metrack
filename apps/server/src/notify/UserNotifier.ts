import type { FetchFn } from '../http/FetchFn.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import { LogNotifier } from './LogNotifier.js';
import type { Logger } from './Logger.js';
import type { Notifier } from './Notifier.js';
import type { NotifyOptions } from './NotifyOptions.js';
import type { NtfyServer } from './NtfyServer.js';
import { NtfyNotifier } from './NtfyNotifier.js';

/** Sends to the ntfy topic the user has set when the alert goes out, and only logs it when they have none. */
export class UserNotifier implements Notifier {
  constructor(
    private readonly settings: UserSettingsRepository,
    private readonly userId: number,
    private readonly server: NtfyServer | undefined,
    private readonly logger: Logger,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async notify(title: string, message: string, options?: NotifyOptions): Promise<boolean> {
    const topic = (await this.settings.get(this.userId))?.ntfyTopic;
    if (!this.server || !topic) return new LogNotifier(this.logger).notify(title, message);
    return new NtfyNotifier({ ...this.server, topic }, this.logger, this.fetchFn).notify(
      title,
      message,
      options,
    );
  }
}
