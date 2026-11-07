import type { UserJobContext } from '../users/UserJobContext.js';
import { UserQueues } from '../users/UserQueues.js';
import { createSyncQueue } from './createSyncQueue.js';
import type { UserSyncServices } from './UserSyncServices.js';

/** One delayed sync queue per user with a Jellyfin account, each running as its user. */
export function createUserSyncQueues(
  services: UserSyncServices,
  jobs: UserJobContext,
  delayMs: number,
  downstream: readonly (UserQueues | undefined)[],
): UserQueues {
  return new UserQueues(
    () => services.users(),
    (userId) =>
      createSyncQueue({
        services,
        userId,
        notifier: jobs.notifier(userId),
        logger: jobs.logger(userId),
        scheduler: jobs.scheduler(userId),
        delayMs,
        downstream,
      }),
  );
}
