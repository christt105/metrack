import type { JobQueue } from '../../src/jobs/JobQueue.js';
import { OWNER_ID } from '../../src/users/OWNER_ID.js';
import { UserQueues } from '../../src/users/UserQueues.js';

/** A job enabled only for the owner, running on the given queue. */
export function ownerQueues(queue: JobQueue): UserQueues {
  return new UserQueues(
    async () => [OWNER_ID],
    () => queue,
  );
}
