import type { GlobalContentVersion } from './GlobalContentVersion.js';

/**
 * A counter per user that grows whenever anything a public page or the library list shows may have changed. Every
 * writer must bump it: the API through `bumpContentVersionOnWrite`, and any job that writes outside a request
 * (sync, imports).
 */
export interface ContentVersions {
  bump(userId: number): Promise<void>;
  /** The counter as it is now. */
  current(userId: number): Promise<number>;
  /**
   * The counters of all users in one read. Catalog rows are shared, so a write by anyone may change what another
   * user's list shows, and this value changes with every write by anyone.
   */
  global(): Promise<GlobalContentVersion>;
}
