import type { Logger } from '../notify/Logger.js';
import type { UserScope } from '../users/UserScope.js';
import type { ReleaseWatcher } from './ReleaseWatcher.js';

/**
 * One release watcher per user whose settings enable alerts. Each pass runs every watcher as its user, so a
 * user's followed titles, created seasons and sent alerts stay theirs, and one user's failure does not stop
 * the others.
 */
export class UserReleaseWatchers {
  private readonly watchers = new Map<number, ReleaseWatcher>();

  constructor(
    private readonly users: () => Promise<number[]>,
    private readonly create: (userId: number) => ReleaseWatcher,
    private readonly scope: UserScope,
    private readonly logger: Logger,
  ) {}

  async tick(): Promise<void> {
    for (const userId of await this.users()) {
      let watcher = this.watchers.get(userId);
      if (!watcher) {
        watcher = this.create(userId);
        this.watchers.set(userId, watcher);
      }
      const current = watcher;
      try {
        await this.scope.run(userId, () => current.tick());
      } catch (error) {
        this.logger.error(
          `release watcher failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
