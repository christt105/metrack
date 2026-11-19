import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import { DEFAULT_QUEUE_OPTIONS, JobQueue } from '../jobs/JobQueue.js';
import type { Scheduler } from '../jobs/Scheduler.js';
import type { ContentVersions } from '../site/ContentVersions.js';
import type { UserQueues } from '../users/UserQueues.js';
import { describeSyncResult } from './describeSyncResult.js';
import type { UserSyncServices } from './UserSyncServices.js';

export interface SyncQueueDeps {
  services: UserSyncServices;
  userId: number;
  notifier: Notifier;
  logger: Logger;
  /** Must run the callbacks as `userId`. */
  scheduler: Scheduler;
  delayMs: number;
  /** Queues that must run again after a sync wrote something. */
  downstream: readonly (UserQueues | undefined)[];
  /** Bumped for the user after every run, so cached lists of their library are discarded. */
  versions?: ContentVersions;
}

/**
 * Runs one user's sync after Jellyfin webhooks. Bursts of events become one run, an event during a run
 * triggers another afterwards and failures retry with backoff. Whatever the sync wrote is
 * published and mirrored like any other edit.
 */
export function createSyncQueue(deps: SyncQueueDeps): JobQueue {
  return new JobQueue(
    async () => {
      const sync = await deps.services.forUser(deps.userId);
      if (!sync) return 'skipped, no Jellyfin user is set';
      const { result } = await sync.apply().finally(() => deps.versions?.bump(deps.userId));
      for (const queues of deps.downstream) await queues?.markAllDirty();
      return describeSyncResult(result);
    },
    deps.notifier,
    deps.logger,
    deps.scheduler,
    { ...DEFAULT_QUEUE_OPTIONS, debounceMs: deps.delayMs, label: 'jellyfin sync' },
  );
}
