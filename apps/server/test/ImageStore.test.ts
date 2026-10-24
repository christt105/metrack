import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { ImageStore } from '../src/images/ImageStore.js';
import { fakeFetch } from './support/fakeFetch.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { jpeg, png } from './support/sampleImages.js';

let db: DatabaseSync;
let dir: string;

beforeEach(() => {
  db = openTestDatabase();
  dir = join(mkdtempSync(join(tmpdir(), 'metrack-images-')), 'images');
});

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
