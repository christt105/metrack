import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import { DEFAULT_QUEUE_OPTIONS, PublishQueue } from '../publish/PublishQueue.js';
import type { Scheduler } from '../publish/Scheduler.js';
import { describeSyncResult } from './describeSyncResult.js';
import type { SyncService } from './SyncService.js';

export interface SyncQueueDeps {
  sync: SyncService;
  notifier: Notifier;
  logger: Logger;
  scheduler: Scheduler;
  delayMs: number;
  /** Queues that must run again after a sync wrote something. */
  downstream: readonly (PublishQueue | undefined)[];
}

/**
 * Runs the sync after Jellyfin webhooks. Bursts of events become one run, an event during a run
 * triggers another afterwards and failures retry with backoff. Whatever the sync wrote is
 * published and mirrored like any other edit.
 */
export function createSyncQueue(deps: SyncQueueDeps): PublishQueue {
  return new PublishQueue(
    async () => {
      const { result } = await deps.sync.apply();
      for (const queue of deps.downstream) queue?.markDirty();
      return describeSyncResult(result);
    },
    deps.notifier,
    deps.logger,
    deps.scheduler,
    { ...DEFAULT_QUEUE_OPTIONS, debounceMs: deps.delayMs, label: 'jellyfin sync' },
  );
}
