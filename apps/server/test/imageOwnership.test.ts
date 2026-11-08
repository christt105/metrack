import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '@metrack/domain';
import { createImageStore } from '../src/images/createImageStore.js';
import type { ImageStore } from '../src/images/ImageStore.js';
import type { ImageStoreOptions } from '../src/images/ImageStoreOptions.js';
import { SharpImageEncoder } from '../src/images/SharpImageEncoder.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { fakeFetch } from './support/fakeFetch.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { bmp24, photoWithExif, png, solidImage } from './support/sampleImages.js';
import { testUrlGuard } from './support/testUrlGuard.js';

const TMDB = 'https://image.tmdb.org/t/p/original/poster.jpg';

let db: DatabaseSync;

beforeEach(async () => {
  db = openTestDatabase();
  const users = new SqliteUserRepository(db);
  await users.create({ name: 'Ana', email: null });
  await users.create({ name: 'Bea', email: null });
});

function store(fetchFn: FetchFn = fakeFetch({}).fetch, options: ImageStoreOptions = {}) {
  return createImageStore(
    db,
    join(mkdtempSync(join(tmpdir(), 'metrack-own-')), 'images'),
    fetchFn,
    () => new Date('2026-11-07T12:00:00Z'),
    { urlGuard: testUrlGuard, ...options },
  );
}

const user = (id: number, role: User['role'] = 'normal'): User => ({
  id,
  name: `User ${id}`,
  email: null,
  role,
});

async function metadataOf(images: ImageStore, ref: string) {
  const image = await images.get(ref.slice('/api/images/'.length));
  if (!image) throw new Error('not stored');
  return sharp(await images.read(image)).metadata();
}

describe('re-encoding', () => {
  it('stores an upload as WebP without EXIF or GPS, upright', async () => {
    const images = store();
    const photo = await photoWithExif(300, 200);
    expect((await sharp(photo).metadata()).exif?.toString('latin1')).toContain('Test Camera');
    const image = await images.upload(photo, 2);
    expect(image).toMatchObject({ mimeType: 'image/webp', width: 200, height: 300 });
    const metadata = await metadataOf(images, image.ref);
    expect(metadata.format).toBe('webp');
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it('scales a large image down to the longest side it allows', async () => {
    const images = store(undefined, {
      encoder: new SharpImageEncoder({ maxDimension: 400, quality: 80 }),
    });
    const image = await images.upload(await solidImage(1600, 900, 'jpeg'), 2);
    expect([image.width, image.height]).toEqual([400, 225]);
  });

  it('reads BMP screenshots', async () => {
    const images = store();
    const image = await images.upload(bmp24(5, 3, [255, 0, 0]), 2);
    expect(image).toMatchObject({ mimeType: 'image/webp', width: 5, height: 3 });
    const { data } = await sharp(await images.read(image))
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(200);
    expect(data[1]).toBeLessThan(60);
  });

  it('refuses what is not an image and files over the upload limit', async () => {
    const images = store(undefined, { maxUploadBytes: 1000 });
    await expect(images.upload(new TextEncoder().encode('<html>'), 2)).rejects.toMatchObject({
      code: 'unsupported_image',
      status: 400,
    });
    await expect(images.upload(new Uint8Array(1001), 2)).rejects.toMatchObject({
      code: 'image_too_large',
      status: 413,
    });
    expect(await images.list()).toEqual([]);
  });
});

describe('provider images', () => {
  it('links TMDB images and keeps their original bytes as an archive', async () => {
    const original = png(500, 750);
    const images = store(fakeFetch({ [TMDB]: original }).fetch);
    expect(await images.reference(TMDB)).toBe(TMDB);
    const [archived] = await images.list();
    expect(archived).toMatchObject({ sourceUrl: TMDB, mimeType: 'image/png' });
    expect(Buffer.from(await images.read(archived ?? ({} as never))).equals(original)).toBe(true);
  });

  it('copies other providers as WebP owned by nobody', async () => {
    const grid = 'https://cdn2.steamgriddb.com/grid/a.png';
    const images = store(fakeFetch({ [grid]: await solidImage(60, 90) }).fetch);
    const ref = await images.reference(grid);
    expect(ref).toMatch(/^\/api\/images\//);
    expect((await metadataOf(images, ref)).format).toBe('webp');
    expect(await images.usage(1)).toEqual({
      usedBytes: 0,
      quotaBytes: 200 * 1024 * 1024,
      imageEncoding: 'server',
    });
  });
});

describe('ownership and quota', () => {
  it('counts each user’s own images against their quota only', async () => {
    const images = store();
    const first = await images.upload(await solidImage(64, 64), 2);
    expect(await images.usage(2)).toMatchObject({ usedBytes: first.byteSize });
    expect(await images.usage(3)).toMatchObject({ usedBytes: 0 });
    await images.upload(await solidImage(64, 64), 2);
    expect(await images.usage(2)).toMatchObject({ usedBytes: first.byteSize });
    await images.upload(await solidImage(64, 64), 3);
    expect(await images.usage(3)).toMatchObject({ usedBytes: first.byteSize });
    expect(await images.list()).toHaveLength(1);
  });

  it('refuses an image that would go over the quota and stores nothing', async () => {
    const probe = await store().upload(await solidImage(64, 64), 1);
    const images = store(undefined, { quotaBytes: probe.byteSize + 10 });
    await images.upload(await solidImage(64, 64, 'png', { r: 1, g: 2, b: 3 }), 2);
    const before = (await images.list()).length;
    await expect(
      images.upload(await solidImage(64, 64, 'png', { r: 250, g: 2, b: 3 }), 2),
    ).rejects.toMatchObject({ code: 'image_quota_exceeded', status: 409 });
    expect(await images.list()).toHaveLength(before);
    await expect(
      images.upload(await solidImage(64, 64, 'png', { r: 250, g: 2, b: 3 }), 3),
    ).resolves.toBeDefined();
  });

  it('never makes a provider image someone’s own', async () => {
    const grid = 'https://cdn2.steamgriddb.com/grid/a.png';
    const bytes = await solidImage(30, 30);
    const images = store(fakeFetch({ [grid]: bytes, 'https://site.test/a.png': bytes }).fetch);
    const shared = await images.download(grid);
    const copy = await images.copyForUser('https://site.test/a.png', 2);
    expect(copy.hash).toBe(shared.hash);
    expect(await images.usage(2)).toMatchObject({ usedBytes: 0 });
    expect(await images.canRead(shared.hash, user(3))).toBe(true);
  });

  it('lets only the owners and the instance owner see an own image', async () => {
    const images = store();
    const image = await images.upload(await solidImage(20, 20), 2);
    expect(await images.canRead(image.hash, user(2))).toBe(true);
    expect(await images.canRead(image.hash, user(3, 'trusted'))).toBe(false);
    expect(await images.canRead(image.hash, user(1, 'owner'))).toBe(true);
    db.prepare('INSERT INTO movie (title, cover) VALUES (?, ?)').run('Shared', image.ref);
    expect(await images.canRead(image.hash, user(3))).toBe(true);
  });

  it('copies a URL of any public site for a user, checking every redirect', async () => {
    const calls: string[] = [];
    const bytes = await solidImage(10, 10);
    const fetchFn = ((input: string | URL | Request) => {
      const url = input.toString();
      calls.push(url);
      if (url === 'https://short.test/x') {
        return Promise.resolve(
          new Response(null, { status: 302, headers: { location: 'https://nas.internal/x.png' } }),
        );
      }
      if (url === 'https://short.test/ok') {
        return Promise.resolve(
          new Response(null, { status: 301, headers: { location: '/real.png' } }),
        );
      }
      return Promise.resolve(new Response(new Uint8Array(bytes)));
    }) as FetchFn;
    const images = store(fetchFn);
    await expect(images.copyForUser('https://short.test/x', 2)).rejects.toMatchObject({
      code: 'url_not_allowed',
    });
    await expect(images.copyForUser('http://192.168.1.15:8100/x.png', 2)).rejects.toMatchObject({
      code: 'url_not_allowed',
    });
    await expect(images.copyForUser('http://[::1]/x.png', 2)).rejects.toMatchObject({
      code: 'url_not_allowed',
    });
    expect(calls).toEqual(['https://short.test/x']);
    const copy = await images.copyForUser('https://short.test/ok', 2);
    expect(calls.at(-1)).toBe('https://short.test/real.png');
    expect(await images.owns(copy.hash, 2)).toBe(true);
  });
});

describe('orphans', () => {
  it('keeps images a review embeds and archives of linked covers', async () => {
    const images = store(fakeFetch({ [TMDB]: png(5, 5) }).fetch);
    const embedded = await images.upload(await solidImage(8, 8), 1);
    const unused = await images.upload(await solidImage(9, 9), 1);
    await images.reference(TMDB);
    const movie = db.prepare('INSERT INTO movie (title, cover) VALUES (?, ?)').run('M', TMDB);
    db.prepare('INSERT INTO movie_entry (user_id, movie_id, review) VALUES (1, ?, ?)').run(
      movie.lastInsertRowid,
      `Look: ![shot](${embedded.ref})`,
    );
    expect(await images.orphans()).toEqual([unused.hash]);
  });

  it('frees only the images nobody else uses when an account goes', async () => {
    const images = store();
    const mine = await images.upload(await solidImage(8, 8), 3);
    const both = await images.upload(await solidImage(9, 9), 3);
    await images.upload(await solidImage(9, 9), 2);
    const movie = db.prepare('INSERT INTO movie (title) VALUES (?)').run('M');
    for (const [userId, ref] of [
      [3, mine.ref],
      [3, both.ref],
      [2, both.ref],
    ] as const) {
      db.prepare(
        `INSERT INTO movie_entry (user_id, movie_id, review) VALUES (?, ?, ?)
         ON CONFLICT DO UPDATE SET review = review || excluded.review`,
      ).run(userId, movie.lastInsertRowid, `![](${ref})`);
    }
    db.prepare('DELETE FROM user WHERE id = 3').run();
    expect(await images.cleanOrphans(0)).toEqual([mine.hash]);
    expect(await images.usage(2)).toMatchObject({ usedBytes: both.byteSize });
  });

  it('keeps unused images younger than the grace period', async () => {
    const images = store();
    const fresh = await images.upload(await solidImage(8, 8), 1);
    const old = await images.upload(await solidImage(9, 9), 1);
    const claimed = await images.upload(await solidImage(10, 10), 1);
    const day = 24 * 60 * 60 * 1000;
    const at = (ms: number) => new Date(Date.parse('2026-11-07T12:00:00Z') - ms).toISOString();
    db.prepare('UPDATE image SET created_at = ? WHERE hash = ?').run(at(day - 60_000), fresh.hash);
    db.prepare('UPDATE image SET created_at = ? WHERE hash = ?').run(at(day + 60_000), old.hash);
    db.prepare('UPDATE image SET created_at = ? WHERE hash = ?').run(at(3 * day), claimed.hash);
    db.prepare('UPDATE image_owner SET created_at = ?').run(at(3 * day));
    db.prepare('UPDATE image_owner SET created_at = ? WHERE hash = ?').run(
      at(60_000),
      claimed.hash,
    );
    expect(await images.cleanOrphans()).toEqual([old.hash]);
    expect((await images.list()).map((i) => i.hash).sort()).toEqual(
      [fresh.hash, claimed.hash].sort(),
    );
  });
});
