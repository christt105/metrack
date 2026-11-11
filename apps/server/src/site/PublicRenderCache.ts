import type { PublicRenderLookup } from './PublicRenderLookup.js';

/**
 * Resolves the owner of a handle and what was last rendered for one public page. A stored body is valid only
 * while the version it was rendered at equals the user's content version.
 */
export interface PublicRenderCache {
  /** The user a handle belongs to with the stored body for `cacheKey`, or undefined for an unknown handle. */
  lookup(handle: string, cacheKey: string): Promise<PublicRenderLookup | undefined>;
  /** Keeps a body rendered at `version`, replacing the previous one. Answers when it was rendered (epoch seconds). */
  store(
    userId: number,
    cacheKey: string,
    version: number,
    contentType: string,
    body: string,
  ): Promise<number | null>;
}
