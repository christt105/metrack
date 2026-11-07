import { AsyncLocalStorage } from 'node:async_hooks';
import type { UserScope } from './UserScope.js';

/** Binds the user to the asynchronous context, so concurrent requests each see their own. */
export class AsyncUserScope implements UserScope {
  private readonly storage = new AsyncLocalStorage<number>();

  userId(): number {
    const id = this.storage.getStore();
    if (id === undefined) throw new Error('No user is bound to this work');
    return id;
  }

  run<T>(userId: number, work: () => T): T {
    return this.storage.run(userId, work);
  }
}
