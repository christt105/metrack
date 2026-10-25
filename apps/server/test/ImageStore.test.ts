import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { FetchFn } from '../src/http/FetchFn.js';
import { ImageStore, MAX_IMAGE_BYTES } from '../src/images/ImageStore.js';
import { fakeFetch } from './support/fakeFetch.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { jpeg, png } from './support/sampleImages.js';

let db: DatabaseSync;
let dir: string;

beforeEach(() => {
  db = openTestDatabase();
  dir = join(mkdtempSync(join(tmpdir(), 'metrack-images-')), 'images');
});

const CHUNK_BYTES = 1024 * 1024;

/** A fetch whose body is an endless stream of 1 MiB chunks; `pulled` counts the chunks read. */
function endlessFetch(headers: Record<string, string> = {}): {
  fetch: FetchFn;
  pulled: () => number;
} {
  let pulled = 0;
  const chunk = new Uint8Array(CHUNK_BYTES);
  const fetchFn = (() => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(chunk);
      },
    });
    return Promise.resolve(new Response(body, { headers }));
  }) as FetchFn;
  return { fetch: fetchFn, pulled: () => pulled };
}

const insertMovie = (cover: string | null) =>
  db.prepare('INSERT INTO movie (title, cover) VALUES (?, ?)').run('Movie', cover);

describe('ImageStore', () => {
  it('downloads, names the file by content hash and stores the size', async () => {
    const net = fakeFetch({ 'https://img.test/a.png': png(600, 900) });
    const store = new ImageStore(db, dir, net.fetch);
    const image = await store.download('https://img.test/a.png');
    expect(image).toMatchObject({
      width: 600,
      height: 900,
      mimeType: 'image/png',
      sourceUrl: 'https://img.test/a.png',
    });
    expect(image.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(image.ref).toBe(`/api/images/${image.hash}`);
    expect(readdirSync(dir)).toEqual([`${image.hash}.png`]);
    expect(store.get(image.hash)).toEqual(image);
  });

  it('does not download a known URL twice and stores identical content once', async () => {
    const net = fakeFetch({
      'https://img.test/a.png': png(10, 10),
      'https://img.test/b.png': png(10, 10),
    });
    const store = new ImageStore(db, dir, net.fetch);
    const first = await store.download('https://img.test/a.png');
    await store.download('https://img.test/a.png');
    const second = await store.download('https://img.test/b.png');
    expect(net.calls).toEqual(['https://img.test/a.png', 'https://img.test/b.png']);
    expect(second.hash).toBe(first.hash);
    expect(store.list()).toHaveLength(1);
  });

  it('rejects failed downloads and non-image content', async () => {
    const net = fakeFetch({ 'https://img.test/page': Buffer.from('<html>') });
    const store = new ImageStore(db, dir, net.fetch);
    await expect(store.download('https://img.test/missing.png')).rejects.toThrow('404');
    await expect(store.download('https://img.test/page')).rejects.toThrow('Unsupported');
    expect(store.list()).toEqual([]);
  });

  it('stops reading a body without content-length once it exceeds the limit', async () => {
    const net = endlessFetch();
    const store = new ImageStore(db, dir, net.fetch);
    await expect(store.download('https://img.test/huge.png')).rejects.toThrow('too large');
    expect(net.pulled()).toBeLessThanOrEqual(MAX_IMAGE_BYTES / CHUNK_BYTES + 3);
    expect(store.list()).toEqual([]);
  });

  it('enforces the limit when content-length understates the body', async () => {
    const net = endlessFetch({ 'content-length': '100' });
    const store = new ImageStore(db, dir, net.fetch);
    await expect(store.download('https://img.test/liar.png')).rejects.toThrow('too large');
    expect(net.pulled()).toBeLessThanOrEqual(MAX_IMAGE_BYTES / CHUNK_BYTES + 3);
  });

  it('stores identical bytes added concurrently once and answers both callers', async () => {
    const store = new ImageStore(db, dir);
    const [a, b] = await Promise.all([store.add(png(5, 5), null), store.add(png(5, 5), null)]);
    expect(a.hash).toBe(b.hash);
    expect(store.list()).toHaveLength(1);
    expect(readdirSync(dir)).toEqual([`${a.hash}.png`]);
  });

  it('removes its temporary file when the write cannot complete', async () => {
    const store = new ImageStore(db, dir);
    const bytes = png(6, 6);
    const hash = createHash('sha256').update(bytes).digest('hex');
    mkdirSync(join(dir, `${hash}.png`));
    await expect(store.add(bytes, null)).rejects.toThrow();
    expect(readdirSync(dir)).toEqual([`${hash}.png`]);
    expect(store.list()).toEqual([]);
  });

  it('imports local files', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'metrack-src-')), 'cover.jpg');
    writeFileSync(file, jpeg(400, 600));
    const image = await new ImageStore(db, dir).importFile(file);
    expect(image).toMatchObject({ width: 400, height: 600, extension: 'jpg', sourceUrl: null });
  });

  it('lists unreferenced images as orphans and cleans only those', async () => {
    const store = new ImageStore(db, dir);
    const used = await store.add(png(1, 1, 1), null);
    const unused = await store.add(png(1, 1, 2), null);
    insertMovie(used.ref);
    expect(store.orphans()).toEqual([unused.hash]);
    expect(await store.cleanOrphans()).toEqual([unused.hash]);
    expect(store.list().map((i) => i.hash)).toEqual([used.hash]);
    expect(readdirSync(dir)).toEqual([`${used.hash}.png`]);
  });

  it('deleting an image clears the references to it', async () => {
    const store = new ImageStore(db, dir);
    const image = await store.add(png(1, 1), null);
    insertMovie(image.ref);
    expect(await store.delete(image.hash)).toBe(true);
    expect(db.prepare('SELECT cover FROM movie').get()).toEqual({ cover: null });
    expect(readdirSync(dir)).toEqual([]);
    expect(await store.delete(image.hash)).toBe(false);
  });
});
