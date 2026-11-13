import { planSync, type ConnectorUser, type EntityRef, type SyncPlan } from '@metrack/domain';
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
 * read, so the state is read again and the plan recomputed, up to `MAX_PLANS_PER_SYNC` times. Applying also asks for
 * the metadata of the titles the plan created and of the ones the cloud lists as never fetched, so a title whose
 * fetch failed, or that a sync cut short created, gets it on a later sync.
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
      const { contentVersion, state, unfetched } = await this.cloud.syncState(user.id);
      const plan = planSync({
        movies,
        series,
        plays,
        state,
        today: this.now().toISOString().slice(0, 10),
        timeZone: this.timeZone,
      });
      const outcome = { plan, created: 0, unfetched: unfetched.length, refreshed: 0 };
      if (!apply) return outcome;
      if (!hasChanges(plan)) {
        return { ...outcome, refreshed: await this.refresh(user.id, unfetched) };
      }
      try {
        const { result, created } = await this.cloud.sync(user.id, { contentVersion, plan });
        const refreshed = await this.refresh(user.id, [...created, ...unfetched]);
        return { ...outcome, result, created: created.length, refreshed };
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

  /** Asks for the metadata of each title, one request each; returns how many got it. */
  private async refresh(userId: number, refs: EntityRef[]): Promise<number> {
    let refreshed = 0;
    for (const ref of refs) {
      try {
        const result = await this.cloud.refresh(userId, ref);
        if (result.outcome === 'failed') {
          this.logger.error(
            `Refreshing ${ref.type} ${ref.id} of user ${userId} failed: ${result.error}`,
          );
        } else {
          refreshed += 1;
        }
      } catch (error) {
        if (error instanceof CloudError && error.status === 501) break;
        this.logger.error(
          `Refreshing ${ref.type} ${ref.id} of user ${userId} failed: ${String(error)}`,
        );
      }
    }
    return refreshed;
  }
}
