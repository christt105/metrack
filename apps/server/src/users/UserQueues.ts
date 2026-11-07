import type { PublishQueue } from '../publish/PublishQueue.js';

/**
 * One queue per user whose settings enable the job, created the first time it is needed. Each queue coalesces,
 * retries and alerts on its own, so one user's failures never delay another's runs.
 */
export class UserQueues {
  private readonly queues = new Map<number, PublishQueue>();

  constructor(
    private readonly users: () => Promise<number[]>,
    private readonly create: (userId: number) => PublishQueue,
  ) {}

  /** Queues a run for the user. Resolves to false, queueing nothing, when their settings do not enable the job. */
  async markDirty(userId: number): Promise<boolean> {
    if (!(await this.users()).includes(userId)) return false;
    this.queue(userId).markDirty();
    return true;
  }

  /** Queues a run for every user the job is enabled for, and resolves to how many there are. */
  async markAllDirty(): Promise<number> {
    const users = await this.users();
    for (const userId of users) this.queue(userId).markDirty();
    return users.length;
  }

  /** Consecutive failed runs of the user's queue so far. */
  failureCount(userId: number): number {
    return this.queues.get(userId)?.failureCount() ?? 0;
  }

  private queue(userId: number): PublishQueue {
    let queue = this.queues.get(userId);
    if (!queue) {
      queue = this.create(userId);
      this.queues.set(userId, queue);
    }
    return queue;
  }
}
