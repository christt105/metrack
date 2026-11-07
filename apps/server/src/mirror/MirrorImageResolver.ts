import type { MirrorImages } from '@metrack/export';
import type { ImageStore } from '../images/ImageStore.js';
import type { StoredImage } from '../images/StoredImage.js';
import type { ImageCopy } from './ImageCopy.js';
import type { VaultImageIndex } from './VaultImageIndex.js';

const REF = /^\/api\/images\/([0-9a-f]{64})$/;
const REMOTE = /^https?:\/\//;

/**
 * Places stored images in the vault: the original URL when there is one (a linked provider URL stays as it is), otherwise a vault file
 * with the same bytes, otherwise a copy to be written into the covers or files folder. Works on a
 * snapshot of the store taken by `load`, so the export can ask synchronously.
 */
export class MirrorImageResolver implements MirrorImages {
  private readonly copies = new Map<string, ImageCopy>();

  constructor(
    private readonly images: ReadonlyMap<string, StoredImage>,
    private readonly urlHashes: ReadonlyMap<string, string>,
    private readonly index: VaultImageIndex,
    private readonly linkPrefix: string,
    private readonly folders: { covers: string; files: string },
  ) {}

  /** Snapshots every stored image and the stored copy of each of `urls` that has one. */
  static async load(
    store: ImageStore,
    urls: Iterable<string>,
    index: VaultImageIndex,
    linkPrefix: string,
    folders: { covers: string; files: string },
  ): Promise<MirrorImageResolver> {
    const images = new Map((await store.list()).map((image) => [image.hash, image]));
    const urlHashes = new Map<string, string>();
    for (const url of new Set(urls)) {
      const image = await store.findBySourceUrl(url);
      if (image !== undefined) urlHashes.set(url, image.hash);
    }
    return new MirrorImageResolver(images, urlHashes, index, linkPrefix, folders);
  }

  propertyValue(ref: string, current: unknown): string | null {
    if (REMOTE.test(ref)) {
      const hash = this.urlHashes.get(ref);
      const same =
        current === ref ||
        (hash !== undefined && typeof current === 'string' && this.hashOfValue(current) === hash);
      return same ? (current as string) : ref;
    }
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

  private imageOf(ref: string): StoredImage | undefined {
    const hash = REF.exec(ref)?.[1];
    return hash === undefined ? undefined : this.images.get(hash);
  }

  private hashOfValue(value: string): string | null {
    if (REMOTE.test(value)) return this.urlHashes.get(value) ?? null;
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
