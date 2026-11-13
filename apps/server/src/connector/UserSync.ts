import { planSync, type ConnectorUser, type SyncPlan } from '@metrack/domain';
import type { Logger } from '../notify/Logger.js';
import type { SyncSources } from '../sync/SyncSources.js';
import { CloudClient } from './CloudClient.js';
import { CloudError } from './CloudError.js';
import type { UserSyncOutcome } from './UserSyncOutcome.js';

export const MAX_PLANS_PER_SYNC = 3;

const hasChanges = (plan: SyncPlan): boolean =>
  plan.movies.length > 0 || plan.series.length > 0 || plan.unlinked.length > 0;

/**
 * Syncs one user at home: reads Jellyfin and Jellystat, reads the user's state from the cloud, plans the changes with
 * the same `planSync` the server uses, and sends the plan back. A 409 means the library changed since the state was
 * read, so the state is read again and the plan recomputed, up to `MAX_PLANS_PER_SYNC` times.
 */
export class UserSync {
  constructor(
    private readonly cloud: CloudClient,
    private readonly sources: (jellyfinUser: string) => SyncSources,
    private readonly timeZone: string,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(user: ConnectorUser, apply: boolean): Promise<UserSyncOutcome> {
    const { library, playback } = this.sources(user.jellyfinUser);
    const [{ movies, series }, plays] = await Promise.all([library.load(), playback.listPlays()]);
    for (let attempt = 1; ; attempt += 1) {
      const { contentVersion, state } = await this.cloud.syncState(user.id);
      const plan = planSync({
        movies,
        series,
        plays,
        state,
        today: this.now().toISOString().slice(0, 10),
        timeZone: this.timeZone,
      });
      if (!apply || !hasChanges(plan)) return { plan, created: 0, refreshFailures: 0 };
      try {
        const { result, created } = await this.cloud.sync(user.id, { contentVersion, plan });
        let refreshFailures = 0;
        for (const ref of created) {
          try {
            await this.cloud.refresh(user.id, ref);
          } catch (error) {
            if (error instanceof CloudError && error.status === 501) break;
            refreshFailures += 1;
            this.logger.error(
              `Refreshing ${ref.type} ${ref.id} of user ${user.id} failed: ${String(error)}`,
            );
          }
        }
        return { plan, result, created: created.length, refreshFailures };
      } catch (error) {
        if (
          !(error instanceof CloudError && error.status === 409) ||
          attempt >= MAX_PLANS_PER_SYNC
        ) {
          throw error;
        }
      }
    }
  }
}
