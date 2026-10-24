import { existsSync } from 'node:fs';
import type { ImageStore } from '../images/ImageStore.js';
import type { ApplyResult } from './ApplyResult.js';
import type { ImageSource } from './ImageSource.js';
import type { LegacyImageIndex } from './LegacyImageIndex.js';

/** Turns note image values into stored image references without touching the network. */
export class ImageResolver {
  private readonly localRefs = new Map<string, string>();

  constructor(
    private readonly store: ImageStore,
    private readonly stats: ApplyResult['images'],
    private readonly warnings: string[],
    private readonly legacy: LegacyImageIndex | null = null,
  ) {}

  async resolve(source: ImageSource | null, notePath: string): Promise<string | null> {
    if (source === null) return null;
    if (source.kind === 'remote') return this.resolveRemote(source.url, notePath);
    return this.resolveLocal(source.path, notePath);
  }

  private async resolveRemote(url: string, notePath: string): Promise<string | null> {
    const known = this.store.findBySourceUrl(url);
    if (known && existsSync(this.store.pathOf(known))) {
      this.stats.remoteLinked += 1;
      return known.ref;
    }
    const file = this.legacy?.find(url) ?? null;
    if (file !== null) {
      try {
        const image = await this.store.importFile(file, url);
        this.stats.remoteImported += 1;
        return image.ref;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.warnings.push(`${notePath}: could not import ${file} for ${url}: ${reason}`);
      }
    }
    this.stats.remoteUnavailable += 1;
    return null;
  }

  private async resolveLocal(path: string, notePath: string): Promise<string | null> {
    const cached = this.localRefs.get(path);
    if (cached) {
      this.stats.localStored += 1;
      return cached;
    }
    try {
      const image = await this.store.importFile(path);
      this.localRefs.set(path, image.ref);
      this.stats.localStored += 1;
      return image.ref;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.warnings.push(`${notePath}: could not import image ${path}: ${reason}`);
      return null;
    }
  }
}
