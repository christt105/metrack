import type { ContentVersions } from './ContentVersions.js';
import type { GlobalContentVersion } from './GlobalContentVersion.js';

/**
 * Counters kept in memory, for the home server, whose database has no content version column. They restart at 0,
 * but the global value starts from a base that differs on every start, so a validator issued before a restart
 * never matches after it.
 */
export class MemoryContentVersions implements ContentVersions {
  private readonly versions = new Map<number, number>();

  constructor(private readonly base: number = Math.floor(Math.random() * 2 ** 40)) {}

  async bump(userId: number): Promise<void> {
    this.versions.set(userId, (this.versions.get(userId) ?? 0) + 1);
  }

  async current(userId: number): Promise<number> {
    return this.versions.get(userId) ?? 0;
  }

  async global(): Promise<GlobalContentVersion> {
    let total = this.base;
    for (const version of this.versions.values()) total += version;
    return { total, users: this.versions.size };
  }
}
