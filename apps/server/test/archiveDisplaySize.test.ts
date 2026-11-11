import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { FetchFn } from '../src/http/FetchFn.js';
import { createImageStore } from '../src/images/createImageStore.js';
import type { ImageStore } from '../src/images/ImageStore.js';
import { storeOptionsFor } from '../src/images/storeOptionsFor.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { png } from './support/sampleImages.js';

let db: DatabaseSync;
let dir: string;
let requested: string[];

beforeEach(() => {
  db = openTestDatabase();
  dir = join(mkdtempSync(join(tmpdir(), 'metrack-archive-')), 'images');
  requested = [];
});

function store(): ImageStore {
  const fetchFn = (async (input: string | URL | Request) => {
    requested.push(input.toString());
    return new Response(Buffer.from(png(20, 20)), { headers: { 'content-type': 'image/png' } });
  }) as FetchFn;
  const options = storeOptionsFor({
    quotaBytes: 1024 * 1024,
    maxUploadBytes: 1024 * 1024,
    maxDimension: 100,
    quality: 80,
    encodedBy: 'server',
  });
  return createImageStore(db, dir, fetchFn, undefined, {
    ...options,
    urlGuard: { async check() {} },
  });
}

describe('archive size', () => {
  it.each([
    ['https://image.tmdb.org/t/p/original/a.jpg', 'cover', 'https://image.tmdb.org/t/p/w780/a.jpg'],
    [
      'https://image.tmdb.org/t/p/original/a.jpg',
      'banner',
      'https://image.tmdb.org/t/p/w1280/a.jpg',
    ],
    [
      'https://images.igdb.com/igdb/image/upload/t_original/a.jpg',
      'cover',
      'https://images.igdb.com/igdb/image/upload/t_720p/a.jpg',
    ],
    [
      'https://images.igdb.com/igdb/image/upload/t_original/a.jpg',
      'banner',
      'https://images.igdb.com/igdb/image/upload/t_1080p/a.jpg',
    ],
    [
      'https://steamcdn-a.akamaihd.net/steam/apps/1/header.jpg',
      'cover',
      'https://steamcdn-a.akamaihd.net/steam/apps/1/header.jpg',
    ],
  ] as const)('downloads %s as %s from %s', async (url, display, fetched) => {
    await store().reference(url, display);
    expect(requested).toEqual([fetched]);
  });

  it('is found by the linked URL the entity keeps, and not downloaded again', async () => {
    const images = store();
    const url = 'https://image.tmdb.org/t/p/original/a.jpg';
    const archived = await images.archive(url, 'cover');
    expect((await images.findBySourceUrl(url))?.hash).toBe(archived.hash);
    await images.archive(url, 'banner');
    expect(requested).toHaveLength(1);
  });

  it('keeps finding archives made before from the original bytes', async () => {
    const images = store();
    const url = 'https://image.tmdb.org/t/p/original/old.jpg';
    const old = await images.add(png(30, 30), url);
    expect((await images.archive(url, 'cover')).hash).toBe(old.hash);
    expect(requested).toEqual([]);
  });
});
