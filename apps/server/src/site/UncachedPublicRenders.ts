import type { PublicProfileRepository } from '../storage/repositories/PublicProfileRepository.js';
import type { PublicRenderCache } from './PublicRenderCache.js';
import type { PublicRenderLookup } from './PublicRenderLookup.js';

/** Renders every page on every request. The home server uses it: it has no CPU or row budget to protect. */
export class UncachedPublicRenders implements PublicRenderCache {
  constructor(private readonly profiles: PublicProfileRepository) {}

  async lookup(handle: string): Promise<PublicRenderLookup | undefined> {
    const profile = await this.profiles.findByHandle(handle);
    return profile ? { ...profile, version: null, cached: null } : undefined;
  }

  async store(): Promise<null> {
    return null;
  }
}
