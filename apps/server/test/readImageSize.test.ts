import { describe, expect, it } from 'vitest';
import { readImageSize } from '../src/images/readImageSize.js';
import { jpeg, png, webpExtended, webpLossless, webpLossy } from './support/sampleImages.js';

describe('readImageSize', () => {
  it('reads PNG dimensions', () => {
    expect(readImageSize(png(600, 900))).toMatchObject({
      mimeType: 'image/png',
      width: 600,
      height: 900,
    });
  });

  it('reads JPEG dimensions past other segments', () => {
    expect(readImageSize(jpeg(1920, 620))).toMatchObject({
      mimeType: 'image/jpeg',
      extension: 'jpg',
      width: 1920,
      height: 620,
    });
  });

  it.each([
    ['lossy', webpLossy(500, 750)],
    ['lossless', webpLossless(500, 750)],
    ['extended', webpExtended(500, 750)],
  ])('reads %s WebP dimensions', (_name, bytes) => {
    expect(readImageSize(bytes)).toMatchObject({ mimeType: 'image/webp', width: 500, height: 750 });
  });

  it('rejects non-images and truncated headers', () => {
    expect(() => readImageSize(Buffer.from('<html></html>'))).toThrow('Unsupported');
    expect(() => readImageSize(png(1, 1).subarray(0, 10))).toThrow('Unsupported');
  });
});
