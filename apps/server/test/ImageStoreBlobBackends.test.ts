import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DiskImageBlobStore } from '../src/images/DiskImageBlobStore.js';
import type { ImageBlobStore } from '../src/images/ImageBlobStore.js';
import { PublicAddressGuard } from '../src/images/PublicAddressGuard.js';
import { ImageStore } from '../src/images/ImageStore.js';
import { R2ImageBlobStore } from '../src/images/R2ImageBlobStore.js';
import { WebpValidatingEncoder } from '../src/images/WebpValidatingEncoder.js';
import { SqliteImageRepository } from '../src/storage/sqlite/SqliteImageRepository.js';
import { openLocalR2Bucket, type LocalR2 } from './support/openLocalR2Bucket.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { solidImage } from './support/sampleImages.js';

let r2: LocalR2;

beforeAll(async () => {
  r2 = await openLocalR2Bucket();
});

afterAll(async () => {
  await r2.dispose();
});

const backends: [string, () => ImageBlobStore][] = [
  ['disk', () => new DiskImageBlobStore(join(mkdtempSync(join(tmpdir(), 'metrack-blobs-')), 'x'))],
  ['R2 (Miniflare)', () => new R2ImageBlobStore(r2.bucket)],
];

describe.each(backends)('ImageStore with a validating encoder on %s', (_name, open) => {
  const store = () =>
    new ImageStore(new SqliteImageRepository(openTestDatabase()), open(), fetch, undefined, {
      encoder: new WebpValidatingEncoder({ maxDimension: 1920, maxBytes: 5 * 1024 * 1024 }),
      urlGuard: new PublicAddressGuard(),
      quotaBytes: 2000,
      encodedBy: 'client',
    });

  it('keeps an uploaded WebP unchanged, owned by the uploader, and serves it back', async () => {
    const images = store();
    const bytes = await solidImage(40, 30, 'webp', {
      r: Math.floor(Math.random() * 255),
      g: 1,
      b: 2,
    });
    const image = await images.upload(bytes, 1);
    expect(image).toMatchObject({
      mimeType: 'image/webp',
      width: 40,
      height: 30,
      byteSize: bytes.length,
    });
    expect(Buffer.from(await images.read(image)).equals(bytes)).toBe(true);
    expect(await images.owns(image.hash, 1)).toBe(true);
    expect(await images.owns(image.hash, 2)).toBe(false);
    expect(await images.usage(1)).toEqual({
      usedBytes: bytes.length,
      quotaBytes: 2000,
      imageEncoding: 'client',
    });
    expect(await images.usage(2)).toMatchObject({ usedBytes: 0 });
  });

  it('refuses a PNG and an upload over the quota', async () => {
    const images = store();
    await expect(images.upload(await solidImage(10, 10, 'png'), 1)).rejects.toMatchObject({
      code: 'unsupported_image',
    });
    const tight = new ImageStore(
      new SqliteImageRepository(openTestDatabase()),
      open(),
      fetch,
      undefined,
      {
        encoder: new WebpValidatingEncoder({ maxDimension: 1920, maxBytes: 5 * 1024 * 1024 }),
        urlGuard: new PublicAddressGuard(),
        quotaBytes: 10,
      },
    );
    await expect(tight.upload(await solidImage(40, 30, 'webp'), 1)).rejects.toMatchObject({
      code: 'image_quota_exceeded',
    });
  });
});
