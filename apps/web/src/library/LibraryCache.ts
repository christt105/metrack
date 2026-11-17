import type { MediaPage, MediaQuery } from '@metrack/domain';

/** Last library pages by API query, kept in memory so returning to the library paints at once. */
export class LibraryCache {
  private readonly pages = new Map<string, MediaPage>();

  constructor(private readonly capacity: number = 8) {}

  get(query: MediaQuery): MediaPage | undefined {
    const key = this.keyOf(query);
    const page = this.pages.get(key);
    if (page === undefined) return undefined;
    this.pages.delete(key);
    this.pages.set(key, page);
    return page;
  }

  set(query: MediaQuery, page: MediaPage): void {
    const key = this.keyOf(query);
    this.pages.delete(key);
    this.pages.set(key, page);
    while (this.pages.size > this.capacity) {
      const oldest = this.pages.keys().next().value;
      if (oldest === undefined) break;
      this.pages.delete(oldest);
    }
  }

  clear(): void {
    this.pages.clear();
  }

  private keyOf(query: MediaQuery): string {
    const entries = Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return JSON.stringify(entries);
  }
}
