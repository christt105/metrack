import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ImageRejectedError } from '../src/images/ImageRejectedError.js';
import { readWebpHeader } from '../src/images/readWebpHeader.js';
import { WebpValidatingEncoder } from '../src/images/WebpValidatingEncoder.js';
import { jpeg, png, solidImage } from './support/sampleImages.js';

const encoder = new WebpValidatingEncoder({ maxDimension: 1920, maxBytes: 5 * 1024 * 1024 });

async function rejection(bytes: Uint8Array): Promise<ImageRejectedError> {
  const error = await encoder.encode(bytes).catch((cause: unknown) => cause);
  expect(error).toBeInstanceOf(ImageRejectedError);
  return error as ImageRejectedError;
}

describe('readWebpHeader', () => {
  it('reads lossy, lossless and extended WebP files made by sharp', async () => {
    const lossy = await solidImage(321, 123, 'webp');
    const lossless = await sharp(await solidImage(40, 30))
      .webp({ lossless: true })
      .toBuffer();
    const extended = await sharp(await solidImage(64, 48))
      .withMetadata({ exif: { IFD0: { Copyright: 'x' } } })
      .webp()
      .toBuffer();
    expect(readWebpHeader(lossy)).toEqual({ width: 321, height: 123 });
    expect(readWebpHeader(lossless)).toEqual({ width: 40, height: 30 });
    expect(readWebpHeader(extended)).toEqual({ width: 64, height: 48 });
    expect(extended.toString('ascii', 12, 16)).toBe('VP8X');
  });

  it('returns null for other formats, truncated files and broken chunks', async () => {
    const webp = await solidImage(100, 100, 'webp');
    expect(readWebpHeader(png(10, 10))).toBeNull();
    expect(readWebpHeader(jpeg(10, 10))).toBeNull();
    expect(readWebpHeader(webp.subarray(0, 40))).toBeNull();
    expect(readWebpHeader(Buffer.alloc(64))).toBeNull();
    const badStart = Buffer.from(webp);
    badStart[23] = 0;
    expect(readWebpHeader(badStart)).toBeNull();
  });
});

describe('WebpValidatingEncoder', () => {
  it('returns a valid WebP unchanged', async () => {
    const webp = await solidImage(1920, 1080, 'webp');
    expect(await encoder.encode(webp)).toBe(webp);
  });

  it('rejects anything that is not WebP, even if it is a real image', async () => {
    expect((await rejection(await solidImage(10, 10, 'png'))).code).toBe('unsupported_image');
    expect((await rejection(await solidImage(10, 10, 'jpeg'))).code).toBe('unsupported_image');
    expect((await rejection(Buffer.from('RIFF....WEBP'))).code).toBe('unsupported_image');
  });

  it('rejects a WebP whose longest side is over the limit', async () => {
    const error = await rejection(await solidImage(1921, 10, 'webp'));
    expect(error).toMatchObject({ code: 'image_too_large', status: 413 });
    await expect(encoder.encode(await solidImage(10, 1920, 'webp'))).resolves.toBeDefined();
  });

  it('rejects a file over the size limit', async () => {
    const small = new WebpValidatingEncoder({ maxDimension: 1920, maxBytes: 10 });
    await expect(small.encode(await solidImage(10, 10, 'webp'))).rejects.toMatchObject({
      code: 'image_too_large',
    });
  });
});
