import type { FetchFn } from '../http/FetchFn.js';
import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type { NtfyServer } from '../notify/NtfyServer.js';
import { UserNotifier } from '../notify/UserNotifier.js';
import type { Scheduler } from '../publish/Scheduler.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import { ScopedScheduler } from './ScopedScheduler.js';
import type { UserScope } from './UserScope.js';
import type { UserSettings } from './UserSettings.js';

export interface UserJobContextDeps {
  timer: Scheduler;
  scope: UserScope;
  settings: UserSettingsRepository;
  ntfy: NtfyServer | undefined;
  logger: Logger;
  fetchFn?: FetchFn;
}

/** What every per-user job gets: its user's settings, a scheduler that runs as that user, their alerts and a labelled log. */
export class UserJobContext {
  constructor(private readonly deps: UserJobContextDeps) {}

  get settings(): UserSettingsRepository {
    return this.deps.settings;
  }

  get scope(): UserScope {
    return this.deps.scope;
  }

  /** Whether alerts can reach anyone: without an ntfy server they are only logged. */
  get canNotify(): boolean {
    return this.deps.ntfy !== undefined;
  }

  scheduler(userId: number): Scheduler {
    return new ScopedScheduler(this.deps.timer, this.deps.scope, userId);
  }

  notifier(userId: number): Notifier {
    return new UserNotifier(
      this.deps.settings,
      userId,
      this.deps.ntfy,
      this.logger(userId),
      this.deps.fetchFn,
    );
  }

  logger(userId: number): Logger {
    const prefix = `[user ${userId}] `;
    return {
      info: (message) => this.deps.logger.info(`${prefix}${message}`),
      error: (message) => this.deps.logger.error(`${prefix}${message}`),
    };
  }

  /** The users whose settings enable a job, ordered by id. */
  async usersWith(enabled: (settings: UserSettings) => unknown): Promise<number[]> {
    return (await this.deps.settings.list())
      .filter((entry) => Boolean(enabled(entry.settings)))
      .map((entry) => entry.userId);
  }
}
