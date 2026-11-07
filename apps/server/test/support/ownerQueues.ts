import type { PublishQueue } from '../../src/publish/PublishQueue.js';
import { OWNER_ID } from '../../src/users/OWNER_ID.js';
import { UserQueues } from '../../src/users/UserQueues.js';

/** A job enabled only for the owner, running on the given queue. */
export function ownerQueues(queue: PublishQueue): UserQueues {
  return new UserQueues(
    async () => [OWNER_ID],
    () => queue,
  );
}
