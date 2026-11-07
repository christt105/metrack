/**
 * Whose data the repositories read and write. Every personal query filters by `userId()`, so code that runs
 * with no user bound fails instead of seeing everyone's rows.
 */
export interface UserScope {
  /** The bound user. Throws when there is none. */
  userId(): number;
  /** Runs the work, and everything it starts, as the user. */
  run<T>(userId: number, work: () => T): T;
}
