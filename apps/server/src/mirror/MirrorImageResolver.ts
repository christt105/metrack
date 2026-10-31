import type { MirrorImages } from '@metrack/export';
import type { ImageStore } from '../images/ImageStore.js';
import type { ImageCopy } from './ImageCopy.js';
import type { VaultImageIndex } from './VaultImageIndex.js';

const REF = /^\/api\/images\/([0-9a-f]{64})$/;

/**
 * Places stored images in the vault: the original URL when there is one, otherwise a vault file
 * with the same bytes, otherwise a copy to be written into the covers or files folder.
 */
export class MirrorImageResolver implements MirrorImages {
  private readonly copies = new Map<string, ImageCopy>();

  constructor(
    private readonly store: ImageStore,
    private readonly index: VaultImageIndex,
    private readonly linkPrefix: string,
    private readonly folders: { covers: string; files: string },
  ) {}

  propertyValue(ref: string, current: unknown): string | null {
    const image = this.imageOf(ref);
    if (image === undefined) return null;
    if (typeof current === 'string' && this.hashOfValue(current) === image.hash) return current;
    if (image.sourceUrl !== null) return image.sourceUrl;
    return `[[${this.vaultLink(image.hash, image.extension, this.folders.covers)}]]`;
  }

  embedPath(ref: string): string | null {
    const image = this.imageOf(ref);
    return image === undefined
      ? null
      : this.vaultLink(image.hash, image.extension, this.folders.files);
  }

  /** Images that have to be written into the vault, in the order they were first needed. */
  pendingCopies(): ImageCopy[] {
    return [...this.copies.values()];
  }

  private imageOf(ref: string) {
    const hash = REF.exec(ref)?.[1];
    return hash === undefined ? undefined : this.store.get(hash);
  }

  private hashOfValue(value: string): string | null {
    if (/^https?:\/\//.test(value)) return this.store.findBySourceUrl(value)?.hash ?? null;
    return this.index.hashOf(value);
  }

  private vaultLink(hash: string, extension: string, folder: string): string {
    const indexed = this.index.linkOf(hash);
    if (indexed !== null) return indexed;
    let copy = this.copies.get(hash);
    if (copy === undefined) {
      copy = { hash, path: `${folder}/metrack-${hash.slice(0, 16)}.${extension}` };
      this.copies.set(hash, copy);
    }
    return `${this.linkPrefix}/${copy.path}`;
  }
}
