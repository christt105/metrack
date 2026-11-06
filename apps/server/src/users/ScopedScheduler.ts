import type { Scheduler } from '../publish/Scheduler.js';
import type { UserScope } from './UserScope.js';

/**
 * Runs every scheduled callback as one user, whatever request scheduled it, so a queue marked dirty by
 * someone else's edit still works on its owner's data.
 */
export class ScopedScheduler implements Scheduler {
  constructor(
    private readonly inner: Scheduler,
    private readonly scope: UserScope,
    private readonly userId: number,
  ) {}

  schedule(callback: () => void, delayMs: number): void {
    this.inner.schedule(() => this.scope.run(this.userId, callback), delayMs);
  }
}
