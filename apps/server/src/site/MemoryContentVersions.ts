import type { ContentVersions } from './ContentVersions.js';

/** Counters kept in memory, for the home server, whose database has no content version column. They restart at 0. */
export class MemoryContentVersions implements ContentVersions {
  private readonly versions = new Map<number, number>();

  async bump(userId: number): Promise<void> {
    this.versions.set(userId, (this.versions.get(userId) ?? 0) + 1);
  }

  async current(userId: number): Promise<number> {
    return this.versions.get(userId) ?? 0;
  }
}
