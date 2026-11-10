import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import {
  isLinkedImageUrl,
  type ImageEncodingSite,
  type ImageUsage,
  type User,
} from '@metrack/domain';
import type { FetchFn } from '../http/FetchFn.js';
import type { ImageRepository } from '../storage/repositories/ImageRepository.js';
import type { ImageBlobStore } from './ImageBlobStore.js';
import type { ImageEncoder } from './ImageEncoder.js';
import { ImageRejectedError } from './ImageRejectedError.js';
import { OversizeImageError } from './OversizeImageError.js';
import { imageRef } from './imageRef.js';
import type { ImageStoreOptions } from './ImageStoreOptions.js';
import { PublicAddressGuard } from './PublicAddressGuard.js';
import { readBodyWithLimit } from './readBodyWithLimit.js';
import { readImageSize } from './readImageSize.js';
import { SharpImageEncoder } from './SharpImageEncoder.js';
import type { StoredImage } from './StoredImage.js';
import type { UrlGuard } from './UrlGuard.js';

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const DEFAULT_QUOTA_BYTES = 200 * 1024 * 1024;
export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const DEFAULT_MAX_DIMENSION = 1920;
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

const MAX_REDIRECTS = 3;

/**
 * Image store. Files are named by the SHA-256 of their content, so identical
 * images are stored once. Entities point at the copy through `imageRef`. An image keeps the
 * first URL it came from as `sourceUrl`; any other URL that yields the same bytes is recorded
 * as an extra source so `findBySourceUrl` resolves it too.
 *
 * Covers and banners from TMDB, Steam and IGDB are linked: entities keep the provider URL and the store only
 * keeps the original bytes as an archive. Everything else is re-encoded to WebP before it is stored. Images
 * no provider gave (uploads, URLs of any site) belong to the users who added them and count for their quota.
 */
export class ImageStore {
  private readonly encoder: ImageEncoder;
  private readonly urlGuard: UrlGuard;
  readonly quotaBytes: number;
  readonly maxUploadBytes: number;
  readonly encodedBy: ImageEncodingSite;
  readonly maxDimension: number;

  constructor(
    private readonly rows: ImageRepository,
    private readonly blobs: ImageBlobStore,
    private readonly fetchFn: FetchFn = fetch,
    private readonly now: () => Date = () => new Date(),
    options: ImageStoreOptions = {},
  ) {
    this.encoder = options.encoder ?? new SharpImageEncoder();
    this.urlGuard = options.urlGuard ?? new PublicAddressGuard();
    this.quotaBytes = options.quotaBytes ?? DEFAULT_QUOTA_BYTES;
    this.maxUploadBytes = options.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
    this.encodedBy = options.encodedBy ?? 'server';
    this.maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  }

  /**
   * What a cover or banner column keeps for a provider image: the URL itself when the provider is linked
   * (after archiving the original), otherwise the reference of a WebP copy. When the client encodes images
   * and the copy cannot be stored as it is, the URL itself, shown as a link.
   */
  async reference(url: string): Promise<string> {
    if (isLinkedImageUrl(url)) {
      await this.archive(url);
      return url;
    }
    return this.downloadOrLink(url);
  }

  /** Stores a provider image as WebP unless this exact URL was already stored. */
  async download(url: string): Promise<StoredImage> {
    const known = await this.findBySourceUrl(url);
    if (known && (await this.hasFile(known))) return known;
    const bytes = await this.fetchLimited(url, MAX_IMAGE_BYTES);
    return this.add(await this.encoder.encode(bytes), url);
  }

  /** Keeps the original bytes of a linked provider image, so it can be served again if the provider drops it. */
  async archive(url: string): Promise<StoredImage> {
    const known = await this.findBySourceUrl(url);
    if (known && (await this.hasFile(known))) return known;
    return this.add(await this.fetchLimited(url, MAX_IMAGE_BYTES), url);
  }

  /** Stores a file a user uploaded, as WebP, and counts it for their quota unless they have none. */
  async upload(bytes: Uint8Array, userId: number, unlimited = false): Promise<StoredImage> {
    if (bytes.byteLength > this.maxUploadBytes) throw tooLarge(this.maxUploadBytes);
    return this.addOwned(await this.encoder.encode(bytes), null, userId, unlimited);
  }

  /** Copies an image from a URL of any public site for a user, as WebP, and counts it for their quota. */
  async copyForUser(url: string, userId: number, unlimited = false): Promise<StoredImage> {
    const bytes = await this.fetchGuarded(url);
    return this.addOwned(await this.encoder.encode(bytes), url, userId, unlimited);
  }

  /**
   * Like `copyForUser`, but when the client encodes images and the fetched image cannot be stored as it is
   * (not WebP, too big or too large), returns the URL itself, to be shown as a link. Addresses that are not
   * allowed and content that is not an image are still refused.
   */
  async copyOrLinkForUser(url: string, userId: number, unlimited = false): Promise<string> {
    let bytes: Uint8Array;
    try {
      bytes = await this.fetchGuarded(url);
    } catch (error) {
      if (this.isOversizeImage(error)) return url;
      throw error;
    }
    const encoded = await this.encodeOrNull(bytes);
    if (encoded === null) return url;
    return (await this.addOwned(encoded, url, userId, unlimited)).ref;
  }

  /** Copies an existing local file into the store, optionally recording the URL it stands for. */
  async importFile(path: string, sourceUrl: string | null = null): Promise<StoredImage> {
    if ((await stat(path)).size > MAX_IMAGE_BYTES) throw tooLarge(MAX_IMAGE_BYTES);
    return this.add(new Uint8Array(await readFile(path)), sourceUrl);
  }

  /** Stores raw image bytes. Throws when they are not a supported image or exceed the size limit. */
  async add(bytes: Uint8Array, sourceUrl: string | null): Promise<StoredImage> {
    const prepared = this.prepare(bytes, sourceUrl);
    const existing = await this.rows.get(prepared.hash);
    if (existing && (await this.hasFile(existing))) return this.withSource(existing, sourceUrl);
    return this.write(prepared, bytes, sourceUrl);
  }

  /** How many bytes of their own images a user keeps, against their quota (`null` when they have none). */
  async usage(userId: number, unlimited = false): Promise<ImageUsage> {
    return {
      usedBytes: await this.rows.usedBytes(userId),
      quotaBytes: unlimited ? null : this.quotaBytes,
      imageEncoding: this.encodedBy,
      maxDimension: this.maxDimension,
    };
  }

  /** Whether the user is one of the owners of the image. */
  async owns(hash: string, userId: number): Promise<boolean> {
    return (await this.rows.ownerIds(hash)).includes(userId);
  }

  /**
   * Whether a user may see an image: provider images and any image a shared catalog row shows are for
   * everyone; an image of someone's own only for its owners and the instance owner.
   */
  async canRead(hash: string, user: User): Promise<boolean> {
    if (user.role === 'owner') return true;
    const owners = await this.rows.ownerIds(hash);
    if (owners.length === 0 || owners.includes(user.id)) return true;
    return this.rows.isShownByCatalog(hash);
  }

  /** The images the user owns. */
  ownedBy(userId: number): Promise<StoredImage[]> {
    return this.rows.ownedBy(userId);
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

  /**
   * Hashes of stored images nothing uses: no cover or banner points at them, by reference or by the linked
   * URL they archive, and no review embeds them. With `graceMs`, images stored or claimed more recently
   * than that are left out.
   */
  orphans(graceMs = 0): Promise<string[]> {
    return this.rows.orphans(
      graceMs > 0 ? new Date(this.now().getTime() - graceMs).toISOString() : undefined,
    );
  }

  /**
   * Deletes those of the given images that are unused (see `orphans`) and that no user owns, and returns
   * their hashes. Used after an account is erased, when only the images it owned can have become unused.
   */
  async removeUnused(hashes: readonly string[]): Promise<string[]> {
    if (hashes.length === 0) return [];
    const unused = new Set(await this.orphans());
    const removed: string[] = [];
    for (const hash of hashes) {
      if (!unused.has(hash) || (await this.rows.ownerIds(hash)).length > 0) continue;
      if (await this.delete(hash)) removed.push(hash);
    }
    return removed;
  }

  /** Deletes every orphan older than the grace period (24 hours) and returns their hashes. */
  async cleanOrphans(graceMs = ORPHAN_GRACE_MS): Promise<string[]> {
    const orphans = await this.orphans(graceMs);
    for (const hash of orphans) await this.delete(hash);
    return orphans;
  }

  /** Every extra URL known to yield a stored image. */
  sources(): Promise<{ url: string; hash: string }[]> {
    return this.rows.listSources();
  }

  /** The stored copy of a URL, without ever hitting the network. */
  findBySourceUrl(url: string): Promise<StoredImage | undefined> {
    return this.rows.findBySourceUrl(url);
  }

  private async downloadOrLink(url: string): Promise<string> {
    const known = await this.findBySourceUrl(url);
    if (known && (await this.hasFile(known))) return known.ref;
    let bytes: Uint8Array;
    try {
      bytes = await this.fetchLimited(url, MAX_IMAGE_BYTES);
    } catch (error) {
      if (this.isOversizeImage(error)) return url;
      throw error;
    }
    const encoded = await this.encodeOrNull(bytes);
    if (encoded === null) return url;
    return (await this.add(encoded, url)).ref;
  }

  /** Encodes the bytes; `null` when the client encodes images and these are a real image that cannot be stored as they are. */
  private async encodeOrNull(bytes: Uint8Array): Promise<Uint8Array | null> {
    try {
      return await this.encoder.encode(bytes);
    } catch (error) {
      if (this.encodedBy === 'client' && error instanceof ImageRejectedError) {
        if (error.code === 'image_too_large') return null;
        if (error.code === 'unsupported_image' && isImage(bytes)) return null;
      }
      throw error;
    }
  }

  private isOversizeImage(error: unknown): boolean {
    return this.encodedBy === 'client' && error instanceof OversizeImageError;
  }

  private async addOwned(
    bytes: Uint8Array,
    sourceUrl: string | null,
    userId: number,
    unlimited: boolean,
  ): Promise<StoredImage> {
    const prepared = this.prepare(bytes, sourceUrl);
    const existing = await this.rows.get(prepared.hash);
    const present = existing !== undefined && (await this.hasFile(existing));
    const owners = present ? await this.rows.ownerIds(prepared.hash) : [];
    if (present && owners.length === 0) return this.withSource(existing, sourceUrl);
    if (!unlimited && !owners.includes(userId)) {
      const used = await this.rows.usedBytes(userId);
      if (used + bytes.byteLength > this.quotaBytes) {
        throw new ImageRejectedError(
          'image_quota_exceeded',
          `Your images would take more than ${megabytes(this.quotaBytes)} MB`,
        );
      }
    }
    const image = present
      ? await this.withSource(existing, sourceUrl)
      : await this.write(prepared, bytes, sourceUrl);
    await this.rows.addOwner(image.hash, userId, this.now().toISOString());
    return image;
  }

  private prepare(bytes: Uint8Array, sourceUrl: string | null): StoredImage {
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw tooLarge(MAX_IMAGE_BYTES);
    const size = readImageSize(bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    return {
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
  }

  private async write(
    image: StoredImage,
    bytes: Uint8Array,
    sourceUrl: string | null,
  ): Promise<StoredImage> {
    await this.blobs.write(fileName(image), bytes);
    await this.rows.insert(image);
    return this.withSource((await this.rows.get(image.hash)) ?? image, sourceUrl);
  }

  private async fetchLimited(url: string, maxBytes: number): Promise<Uint8Array> {
    return this.readLimited(await this.fetchFn(url), url, maxBytes);
  }

  private async fetchGuarded(url: string): Promise<Uint8Array> {
    let current: URL;
    try {
      current = new URL(url);
    } catch {
      throw new ImageRejectedError('url_not_allowed', 'That is not a web address');
    }
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await this.urlGuard.check(current);
      const response = await this.fetchFn(current.toString(), { redirect: 'manual' });
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location !== null) {
        await response.body?.cancel();
        current = new URL(location, current);
        continue;
      }
      return this.readLimited(response, url, this.maxUploadBytes);
    }
    throw new ImageRejectedError('url_not_allowed', 'Too many redirects');
  }

  private async readLimited(
    response: Response,
    url: string,
    maxBytes: number,
  ): Promise<Uint8Array> {
    if (!response.ok) throw new Error(`Image download failed (${response.status}) for ${url}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    const isImageType = (response.headers.get('content-type') ?? '').startsWith('image/');
    if (declared > maxBytes) {
      await response.body?.cancel();
      throw tooLarge(maxBytes, isImageType);
    }
    const bytes = await readBodyWithLimit(response, maxBytes);
    if (bytes === null) throw tooLarge(maxBytes, isImageType);
    return bytes;
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

function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

function tooLarge(maxBytes: number, declaredImage = false): ImageRejectedError {
  const message = `Image too large: the limit is ${megabytes(maxBytes)} MB`;
  return declaredImage
    ? new OversizeImageError(message)
    : new ImageRejectedError('image_too_large', message);
}

function isImage(bytes: Uint8Array): boolean {
  try {
    readImageSize(bytes);
    return true;
  } catch {
    return false;
  }
}
