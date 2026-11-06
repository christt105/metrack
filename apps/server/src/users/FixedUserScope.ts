import type { UserScope } from './UserScope.js';

/** Always one user: the command line tools act as the owner, and tests pick whoever they need. */
export class FixedUserScope implements UserScope {
  constructor(private readonly id: number) {}

  userId(): number {
    return this.id;
  }

  run<T>(userId: number, work: () => T): T {
    if (userId !== this.id) throw new Error(`This scope only acts as user ${this.id}`);
    return work();
  }
}
