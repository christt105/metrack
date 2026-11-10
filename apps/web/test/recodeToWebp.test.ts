import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RECODE_MAX_SIDE, recodeToWebp } from '../src/logic/recodeToWebp';

describe('recodeToWebp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubBrowser(width: number, height: number) {
    const drawn: { width: number; height: number }[] = [];
    vi.stubGlobal('createImageBitmap', async () => ({ width, height, close: () => undefined }));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          readonly width: number,
          readonly height: number,
        ) {
          drawn.push({ width, height });
        }
        getContext() {
          return { drawImage: () => undefined };
        }
        async convertToBlob() {
          return new Blob(['x'], { type: 'image/webp' });
        }
      },
    );
    return drawn;
  }

  it('fits the image within the given longest side', async () => {
    const drawn = stubBrowser(4000, 2000);
    await recodeToWebp(new Blob(['x']), 1280);
    expect(drawn).toEqual([{ width: 1280, height: 640 }]);
  });

  it('defaults to 1920 px', async () => {
    const drawn = stubBrowser(4000, 2000);
    await recodeToWebp(new Blob(['x']));
    expect(DEFAULT_RECODE_MAX_SIDE).toBe(1920);
    expect(drawn).toEqual([{ width: 1920, height: 960 }]);
  });
});
