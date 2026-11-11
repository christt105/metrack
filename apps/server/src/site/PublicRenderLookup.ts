/** What resolving a handle for one public page found. */
export interface PublicRenderLookup {
  userId: number;
  /** Whether the owner has the page switched on. */
  enabled: boolean;
  /** The user's content version; null when the cache is off, which also means no ETag. */
  version: number | null;
  /** The stored body when it was rendered at the current version and has not expired; `renderedAt` is in epoch seconds. */
  cached: { contentType: string; body: string; renderedAt: number } | null;
}
