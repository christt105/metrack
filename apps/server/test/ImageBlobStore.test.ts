import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DiskImageBlobStore } from '../src/images/DiskImageBlobStore.js';
import type { ImageBlobStore } from '../src/images/ImageBlobStore.js';
import { R2ImageBlobStore } from '../src/images/R2ImageBlobStore.js';
import { openLocalR2Bucket, type LocalR2 } from './support/openLocalR2Bucket.js';

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

describe.each(backends)('ImageBlobStore on %s', (_name, open) => {
  it('writes, checks, reads and deletes a file', async () => {
    const store = open();
    const name = `${Math.random().toString(16).slice(2)}.webp`;
    const bytes = Uint8Array.from([1, 2, 3, 250, 251]);
    expect(await store.has(name)).toBe(false);
    await store.write(name, bytes);
    expect(await store.has(name)).toBe(true);
    expect(Array.from(await store.read(name))).toEqual(Array.from(bytes));
    await store.delete(name);
    expect(await store.has(name)).toBe(false);
  });

  it('replaces a file written twice and ignores deleting a missing one', async () => {
    const store = open();
    const name = `${Math.random().toString(16).slice(2)}.webp`;
    await store.write(name, Uint8Array.from([1]));
    await store.write(name, Uint8Array.from([2, 2]));
    expect(Array.from(await store.read(name))).toEqual(Array.from(Uint8Array.from([2, 2])));
    await store.delete(name);
    await expect(store.delete(name)).resolves.toBeUndefined();
  });

  it('fails to read a missing file', async () => {
    await expect(open().read('missing.webp')).rejects.toThrow();
  });
});
