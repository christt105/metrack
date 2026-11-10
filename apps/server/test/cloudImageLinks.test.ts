import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { FetchFn } from '../src/http/FetchFn.js';
import { createImageStore } from '../src/images/createImageStore.js';
import { ImageRejectedError } from '../src/images/ImageRejectedError.js';
import type { ImageStore } from '../src/images/ImageStore.js';
import { storeOptionsFor } from '../src/images/storeOptionsFor.js';
import type { UrlGuard } from '../src/images/UrlGuard.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { jpeg, png, solidImage } from './support/sampleImages.js';

const MB = 1024 * 1024;
const guard: UrlGuard = {
  async check(url) {
    if (url.hostname === 'lan.local') throw new ImageRejectedError('url_not_allowed', 'no');
  },
};

interface Served {
  body: Uint8Array;
  type: string;
  length?: number;
}

function serving(routes: Record<string, Served>): FetchFn {
  return (async (input: string | URL | Request) => {
    const served = routes[input.toString()];
    if (!served) return new Response('missing', { status: 404 });
    const headers: Record<string, string> = { 'content-type': served.type };
    if (served.length !== undefined) headers['content-length'] = String(served.length);
    return new Response(Buffer.from(served.body), { headers });
  }) as FetchFn;
}

let db: DatabaseSync;
let dir: string;

beforeEach(() => {
  db = openTestDatabase();
  dir = join(mkdtempSync(join(tmpdir(), 'metrack-links-')), 'images');
});

function store(encodedBy: 'server' | 'client', fetchFn: FetchFn): ImageStore {
  const options = storeOptionsFor({
    quotaBytes: 10 * MB,
    maxUploadBytes: MB,
    maxDimension: 100,
    quality: 80,
    encodedBy,
  });
  return createImageStore(db, dir, fetchFn, undefined, { ...options, urlGuard: guard });
}

const okWebp = await solidImage(50, 40, 'webp');
const bigWebp = await solidImage(500, 400, 'webp');
const html = new TextEncoder().encode('<html></html>');
const routes: Record<string, Served> = {
  'https://img.test/ok.webp': { body: okWebp, type: 'image/webp' },
  'https://img.test/big.webp': { body: bigWebp, type: 'image/webp' },
  'https://img.test/a.png': { body: png(20, 20), type: 'image/png' },
  'https://img.test/a.jpg': { body: jpeg(20, 20), type: 'image/jpeg' },
  'https://img.test/page.html': { body: html, type: 'text/html' },
  'https://img.test/huge.png': { body: png(20, 20), type: 'image/png', length: 30 * MB },
  'https://img.test/huge.bin': { body: html, type: 'text/html', length: 30 * MB },
  'https://img.test/over-upload.png': { body: png(20, 20), type: 'image/png', length: 2 * MB },
  'https://lan.local/a.png': { body: png(20, 20), type: 'image/png' },
};

describe('client mode falls back to a link', () => {
  describe.each([
    ['provider copy (reference)', (s: ImageStore, url: string) => s.reference(url)],
    ['loose URL (copyOrLinkForUser)', (s: ImageStore, url: string) => s.copyOrLinkForUser(url, 1)],
  ])('%s', (_name, run) => {
    it('stores a WebP within the limits as a copy', async () => {
      const images = store('client', serving(routes));
      const ref = await run(images, 'https://img.test/ok.webp');
      expect(ref).toMatch(/^\/api\/images\/[0-9a-f]{64}$/);
      expect(await images.list()).toHaveLength(1);
    });

    it.each(['big.webp', 'a.png', 'a.jpg', 'huge.png'])(
      'keeps %s as the remote URL',
      async (file) => {
        const images = store('client', serving(routes));
        const url = `https://img.test/${file}`;
        expect(await run(images, url)).toBe(url);
        expect(await images.list()).toHaveLength(0);
      },
    );

    it('still refuses non-image content', async () => {
      const images = store('client', serving(routes));
      await expect(run(images, 'https://img.test/page.html')).rejects.toMatchObject({
        code: 'unsupported_image',
      });
      await expect(run(images, 'https://img.test/huge.bin')).rejects.toBeInstanceOf(
        ImageRejectedError,
      );
    });
  });

  it('still refuses private addresses and charges no quota for links', async () => {
    const images = store('client', serving(routes));
    await expect(images.copyOrLinkForUser('https://lan.local/a.png', 1)).rejects.toMatchObject({
      code: 'url_not_allowed',
    });
    await images.copyOrLinkForUser('https://img.test/a.png', 1);
    await images.copyOrLinkForUser('https://img.test/over-upload.png', 1);
    expect((await images.usage(1)).usedBytes).toBe(0);
  });
});

describe('server mode is unchanged', () => {
  it('refuses what cannot be read and never links', async () => {
    const images = store('server', serving(routes));
    await expect(images.copyOrLinkForUser('https://img.test/huge.png', 1)).rejects.toMatchObject({
      code: 'image_too_large',
    });
    await expect(images.copyOrLinkForUser('https://img.test/page.html', 1)).rejects.toMatchObject({
      code: 'unsupported_image',
    });
    await expect(images.reference('https://img.test/huge.png')).rejects.toMatchObject({
      code: 'image_too_large',
    });
    await expect(images.reference('https://img.test/page.html')).rejects.toBeDefined();
  });

  it('reports the configured maximum dimension in the usage', async () => {
    expect(await store('server', serving(routes)).usage(1)).toMatchObject({ maxDimension: 100 });
    expect(await store('client', serving(routes)).usage(1)).toMatchObject({ maxDimension: 100 });
  });
});
