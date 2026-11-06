import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import type { FetchFn } from '../http/FetchFn.js';
import type { ImageRepository } from '../storage/repositories/ImageRepository.js';
import type { ImageBlobStore } from './ImageBlobStore.js';
import { imageRef } from './imageRef.js';
import { readBodyWithLimit } from './readBodyWithLimit.js';
import { readImageSize } from './readImageSize.js';
import type { StoredImage } from './StoredImage.js';

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/**
 * Image store. Files are named by the SHA-256 of their content, so identical
 * images are stored once. Entities point at the copy through `imageRef`. An image keeps the
 * first URL it came from as `sourceUrl`; any other URL that yields the same bytes is recorded
 * as an extra source so `findBySourceUrl` resolves it too.
 */
export class ImageStore {
  constructor(
    private readonly rows: ImageRepository,
    private readonly blobs: ImageBlobStore,
    private readonly fetchFn: FetchFn = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Downloads an image unless this exact URL was already stored. */
  async download(url: string): Promise<StoredImage> {
    const known = await this.findBySourceUrl(url);
    if (known && (await this.hasFile(known))) return known;

    const response = await this.fetchFn(url);
    if (!response.ok) throw new Error(`Image download failed (${response.status}) for ${url}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_IMAGE_BYTES) {
      await response.body?.cancel();
      throw new Error(`Image too large: ${url}`);
    }
    const bytes = await readBodyWithLimit(response, MAX_IMAGE_BYTES);
    if (bytes === null) throw new Error(`Image too large: ${url}`);
    return this.add(bytes, url);
  }

  /** Copies an existing local file into the store, optionally recording the URL it stands for. */
  async importFile(path: string, sourceUrl: string | null = null): Promise<StoredImage> {
    if ((await stat(path)).size > MAX_IMAGE_BYTES) throw new Error('Image too large');
    return this.add(new Uint8Array(await readFile(path)), sourceUrl);
  }

  /** Stores raw image bytes. Throws when they are not a supported image or exceed the size limit. */
  async add(bytes: Uint8Array, sourceUrl: string | null): Promise<StoredImage> {
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Image too large');
    const size = readImageSize(bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const existing = await this.rows.get(hash);
    if (existing && (await this.hasFile(existing))) return this.withSource(existing, sourceUrl);

    const image: StoredImage = {
      hash,
      ref: imageRef(hash),
      extension: size.extension,
      mimeType: size.mimeType,
      width: size.width,
      height: size.height,
      byteSize: bytes.byteLength,
      sourceUrl,
      createdAt: this.now().toISOString(),
    };
    await this.blobs.write(fileName(image), bytes);
    await this.rows.insert(image);
    return this.withSource((await this.rows.get(hash)) ?? image, sourceUrl);
  }

  get(hash: string): Promise<StoredImage | undefined> {
    return this.rows.get(hash);
  }

  list(): Promise<StoredImage[]> {
    return this.rows.list();
  }

  /** Whether the bytes of a known image are actually in the store. */
  hasFile(image: StoredImage): Promise<boolean> {
    return this.blobs.has(fileName(image));
  }

  read(image: StoredImage): Promise<Uint8Array> {
    return this.blobs.read(fileName(image));
  }

  /** Deletes the file and its row and clears every cover or banner that referenced it. */
  async delete(hash: string): Promise<boolean> {
    const image = await this.rows.get(hash);
    if (!image) return false;
    await this.rows.delete(hash);
    await this.blobs.delete(fileName(image));
    return true;
  }

  /** Hashes of stored images that no entity references. */
  orphans(): Promise<string[]> {
    return this.rows.orphans();
  }

  /** Deletes every orphan and returns their hashes. */
  async cleanOrphans(): Promise<string[]> {
    const orphans = await this.orphans();
    for (const hash of orphans) await this.delete(hash);
    return orphans;
  }

  /** The stored copy of a URL, without ever hitting the network. */
  findBySourceUrl(url: string): Promise<StoredImage | undefined> {
    return this.rows.findBySourceUrl(url);
  }

  private async withSource(image: StoredImage, sourceUrl: string | null): Promise<StoredImage> {
    if (sourceUrl !== null && sourceUrl !== image.sourceUrl) {
      await this.rows.addSource(sourceUrl, image.hash);
    }
    return image;
  }
}

function fileName(image: StoredImage): string {
  return `${image.hash}.${image.extension}`;
}
